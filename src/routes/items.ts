import { Hono } from "hono";
import { db, logAudit } from "../db.ts";
import { runRecheck } from "../automations/index.ts";
import { rescheduleAll } from "../scheduler.ts";
import { advance, addDays, localToday } from "../dates.ts";
import type { Item, ItemList } from "../types.ts";

const route = new Hono();

const VALID_LISTS: ItemList[] = ["routine", "active", "mim", "archived"];
const EDITABLE = [
  "title",
  "emoji",
  "notes",
  "next_action_date",
  "lead_days",
  "snoozed_until",
  "mode",
  "automation_type",
  "automation_config",
  "check_schedule",
  "url",
  "check_cadence",
] as const;

/** A check_cadence value is valid if it is null or one of the known cadences. */
function isValidCadence(v: unknown): boolean {
  return v == null || v === "weekly" || v === "monthly";
}

function getItem(id: number): Item | null {
  return db.query<Item, [number]>("SELECT * FROM items WHERE id = ?").get(id) ?? null;
}

route.get("/", (c) => {
  const list = c.req.query("list");
  if (list && !VALID_LISTS.includes(list as ItemList)) {
    return c.json({ error: "Invalid list" }, 400);
  }
  const rows = list
    ? db
        .query<Item, [string]>(
          `SELECT * FROM items WHERE list = ?
           ORDER BY (next_action_date IS NULL), next_action_date ASC, created_at ASC`,
        )
        .all(list)
    : db
        .query<Item, []>(
          `SELECT * FROM items
           ORDER BY list, (next_action_date IS NULL), next_action_date ASC`,
        )
        .all();
  return c.json({ items: rows });
});

route.get("/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const item = getItem(id);
  if (!item) return c.json({ error: "Not found" }, 404);
  return c.json({ item });
});

route.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Partial<Item> | null;
  if (!body?.title) return c.json({ error: "title required" }, 400);

  const list: ItemList =
    body.list && VALID_LISTS.includes(body.list) ? body.list : "active";
  const mode = body.mode === "auto" ? "auto" : "manual";
  if (!isValidCadence(body.check_cadence)) {
    return c.json({ error: "Invalid check_cadence" }, 400);
  }

  const inserted = db
    .query<{ id: number }, [
      string, string, string | null, string | null, string | null, number,
      string | null, string, string | null, string | null, string | null,
      string | null, string | null,
    ]>(
      `INSERT INTO items
        (list, title, emoji, notes, next_action_date, lead_days, snoozed_until,
         mode, automation_type, automation_config, check_schedule, url, check_cadence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      list,
      body.title,
      body.emoji ?? null,
      body.notes ?? null,
      body.next_action_date ?? null,
      body.lead_days ?? 0,
      body.snoozed_until ?? null,
      mode,
      body.automation_type ?? null,
      body.automation_config ?? null,
      body.check_schedule ?? null,
      body.url ?? null,
      body.check_cadence ?? null,
    );
  if (!inserted) return c.json({ error: "Insert failed" }, 500);

  logAudit(inserted.id, "created", { list, mode });
  if (mode === "auto" && body.check_schedule) rescheduleAll();

  return c.json({ item: getItem(inserted.id) }, 201);
});

route.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const existing = getItem(id);
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: "Invalid body" }, 400);

  const sets: string[] = [];
  const values: unknown[] = [];
  if ("list" in body) {
    const newList = body.list;
    if (typeof newList !== "string" || !VALID_LISTS.includes(newList as ItemList)) {
      return c.json({ error: "Invalid list" }, 400);
    }
    sets.push("list = ?");
    values.push(newList);
  }
  if ("check_cadence" in body && !isValidCadence(body.check_cadence)) {
    return c.json({ error: "Invalid check_cadence" }, 400);
  }
  for (const f of EDITABLE) {
    if (f in body) {
      sets.push(`${f} = ?`);
      values.push(body[f] ?? null);
    }
  }
  if (sets.length > 0) {
    values.push(id);
    db.query(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`).run(...(values as never[]));
    logAudit(id, "updated", { fields: sets.map((s) => s.split(" ")[0]) });
  }

  if ("check_schedule" in body || "mode" in body || "list" in body) rescheduleAll();
  return c.json({ item: getItem(id) });
});

route.post("/:id/move", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const body = (await c.req.json().catch(() => null)) as { list?: string } | null;
  if (!body?.list || !VALID_LISTS.includes(body.list as ItemList)) {
    return c.json({ error: "Invalid list" }, 400);
  }
  const existing = getItem(id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  db.query("UPDATE items SET list = ? WHERE id = ?").run(body.list, id);
  logAudit(id, "moved", { from: existing.list, to: body.list });
  return c.json({ item: getItem(id) });
});

route.post("/:id/snooze", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const body = (await c.req.json().catch(() => null)) as
    | { until?: string; days?: number }
    | null;

  let until: string;
  if (body?.until) {
    until = body.until;
  } else if (body?.days && Number.isFinite(body.days)) {
    until = addDays(localToday(), body.days);
  } else {
    return c.json({ error: "until (YYYY-MM-DD) or days required" }, 400);
  }

  const existing = getItem(id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  db.query("UPDATE items SET snoozed_until = ? WHERE id = ?").run(until, id);
  logAudit(id, "snoozed", { until });
  return c.json({ item: getItem(id) });
});

route.post("/:id/recheck", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const existing = getItem(id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const result = await runRecheck(existing);
  if (result.notesUpdate != null) {
    db.query(
      "UPDATE items SET last_checked_at = datetime('now'), last_status = ?, notes = ? WHERE id = ?",
    ).run(result.status, result.notesUpdate, id);
  } else {
    db.query(
      "UPDATE items SET last_checked_at = datetime('now'), last_status = ? WHERE id = ?",
    ).run(result.status, id);
  }
  logAudit(id, "recheck_manual", result);
  return c.json({ item: getItem(id), result });
});

// "I just checked this" — advance the due date by the item's cadence, clear any
// snooze, and stamp last_checked_at. See src/dates.ts for the advance algorithm.
route.post("/:id/advance", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const existing = getItem(id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.check_cadence !== "weekly" && existing.check_cadence !== "monthly") {
    return c.json({ error: "no cadence set" }, 400);
  }
  if (!existing.next_action_date) {
    return c.json({ error: "no date to advance from" }, 400);
  }
  const from = existing.next_action_date;
  const to = advance(from, existing.check_cadence, localToday());
  db.query(
    "UPDATE items SET next_action_date = ?, last_checked_at = datetime('now'), snoozed_until = NULL WHERE id = ?",
  ).run(to, id);
  logAudit(id, "advanced", { from, to, cadence: existing.check_cadence });
  return c.json({ item: getItem(id) });
});

export default route;
