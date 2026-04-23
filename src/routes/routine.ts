import { Hono } from "hono";
import { db, logAudit } from "../db.ts";
import type { Item } from "../types.ts";

const route = new Hono();

route.get("/today", (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const items = db
    .query<Item, []>("SELECT * FROM items WHERE list = 'routine' ORDER BY id ASC")
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
