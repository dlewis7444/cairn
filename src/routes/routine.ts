import { Hono } from "hono";
import { db, logAudit } from "../db.ts";
import type { Item } from "../types.ts";

const route = new Hono();

route.get("/today", (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const items = db
    .query<Item, []>(
      `SELECT * FROM items WHERE list = 'routine'
       ORDER BY COALESCE(sort_order, id) ASC, id ASC`,
    )
    .all();
  const completed = db
    .query<{ item_id: number }, [string]>(
      "SELECT item_id FROM routine_completions WHERE completed_on = ?",
    )
    .all(today);
  const completedSet = new Set(completed.map((r) => r.item_id));
  return c.json({
    today,
    items: items.map((it) => ({ ...it, completed_today: completedSet.has(it.id) })),
  });
});

route.post("/reset-today", (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .query("DELETE FROM routine_completions WHERE completed_on = ?")
    .run(today);
  logAudit(null, "routine_reset", { date: today, deleted: result.changes });
  return c.json({ ok: true, date: today, deleted: result.changes });
});

route.post("/reorder", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n))) {
    return c.json({ error: "ids must be an array of integers" }, 400);
  }
  const routineIds = new Set(
    db
      .query<{ id: number }, []>("SELECT id FROM items WHERE list = 'routine'")
      .all()
      .map((r) => r.id),
  );
  if (ids.length !== routineIds.size || !ids.every((id) => routineIds.has(id as number))) {
    return c.json({ error: "ids must match the current routine list exactly" }, 400);
  }
  const update = db.query("UPDATE items SET sort_order = ? WHERE id = ?");
  const tx = db.transaction((arr: number[]) => {
    arr.forEach((id, i) => update.run(i, id));
  });
  tx(ids as number[]);
  logAudit(null, "routine_reorder", { ids });
  return c.json({ ok: true, ids });
});

route.post("/:id/complete", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);
  const item = db
    .query<Item, [number]>("SELECT * FROM items WHERE id = ? AND list = 'routine'")
    .get(id);
  if (!item) return c.json({ error: "Not a routine item" }, 404);
  const today = new Date().toISOString().slice(0, 10);
  db.query(
    "INSERT OR IGNORE INTO routine_completions (item_id, completed_on) VALUES (?, ?)",
  ).run(id, today);
  logAudit(id, "routine_complete", { date: today });
  return c.json({ ok: true, item_id: id, completed_on: today });
});

export default route;
