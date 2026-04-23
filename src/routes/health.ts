import { Hono } from "hono";
import { db } from "../db.ts";

const route = new Hono();

route.get("/", (c) => {
  let dbOk = false;
  try {
    db.query("SELECT 1").get();
    dbOk = true;
  } catch {
    /* db down */
  }
  const lastDigest = db
    .query<{ created_at: string }, []>(
      `SELECT created_at FROM audit_log
       WHERE event_type = 'digest_sent'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get();
  return c.json({
    status: dbOk ? "ok" : "degraded",
    db_ok: dbOk,
    last_digest_at: lastDigest?.created_at ?? null,
    version: "0.1.0",
  });
});

export default route;
