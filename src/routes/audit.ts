import { Hono } from "hono";
import { db } from "../db.ts";
import type { AuditLogRow } from "../types.ts";

const route = new Hono();

route.get("/", (c) => {
  const itemId = c.req.query("item_id");
  const limit = Math.min(Number(c.req.query("limit")) || 100, 500);
  const rows = itemId
    ? db
        .query<AuditLogRow, [number, number]>(
          "SELECT * FROM audit_log WHERE item_id = ? ORDER BY created_at DESC LIMIT ?",
        )
        .all(Number(itemId), limit)
    : db
        .query<AuditLogRow, [number]>(
          "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?",
        )
        .all(limit);
  return c.json({ entries: rows });
});

export default route;
