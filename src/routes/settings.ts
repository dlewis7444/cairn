import { Hono } from "hono";
import { db, logAudit } from "../db.ts";
import { env } from "../config.ts";

const route = new Hono();

const EDITABLE_KEYS = ["headerMorningCoffee", "headerTheCairn"] as const;
type SettingKey = (typeof EDITABLE_KEYS)[number];

function defaults(): Record<SettingKey, string> {
  return {
    headerMorningCoffee: env.headerMorningCoffee,
    headerTheCairn: env.headerTheCairn,
  };
}

function overrides(): Record<string, string> {
  const rows = db
    .query<{ key: string; value: string | null }, []>("SELECT key, value FROM settings")
    .all();
  const out: Record<string, string> = {};
  for (const r of rows) if (r.value != null) out[r.key] = r.value;
  return out;
}

export function uiSettings(): Record<SettingKey, string> {
  return { ...defaults(), ...overrides() } as Record<SettingKey, string>;
}

route.get("/", (c) => c.json({ current: uiSettings(), defaults: defaults() }));

route.patch("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return c.json({ error: "Invalid body" }, 400);

  for (const key of Object.keys(body)) {
    if (!(EDITABLE_KEYS as readonly string[]).includes(key)) {
      return c.json({ error: `Invalid key: ${key}` }, 400);
    }
    const v = body[key];
    if (v !== null && typeof v !== "string") {
      return c.json({ error: `Value for ${key} must be string or null` }, 400);
    }
  }

  const upsert = db.query(
    `INSERT INTO settings(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  );
  const del = db.query("DELETE FROM settings WHERE key = ?");

  for (const [key, raw] of Object.entries(body)) {
    if (raw == null) {
      del.run(key);
      logAudit(null, "setting_reset", { key });
    } else {
      upsert.run(key, raw as string);
      logAudit(null, "setting_set", { key, value: raw });
    }
  }

  return c.json({ current: uiSettings(), defaults: defaults() });
});

export default route;
