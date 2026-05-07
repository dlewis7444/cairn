import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./config.ts";

mkdirSync(dirname(env.dbPath), { recursive: true });

export const db = new Database(env.dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list TEXT NOT NULL CHECK (list IN ('routine', 'active', 'mim', 'archived')),
  title TEXT NOT NULL,
  emoji TEXT,
  notes TEXT,
  next_action_date TEXT,
  lead_days INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT,
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'auto')),
  automation_type TEXT CHECK (automation_type IS NULL OR automation_type IN ('script', 'playwright', 'ai')),
  automation_config TEXT,
  check_schedule TEXT,
  last_checked_at TEXT,
  last_status TEXT,
  sort_order INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_list ON items(list);
CREATE INDEX IF NOT EXISTS idx_items_next_action ON items(next_action_date);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_item ON audit_log(item_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS routine_completions (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  completed_on TEXT NOT NULL,
  PRIMARY KEY (item_id, completed_on)
);

CREATE TRIGGER IF NOT EXISTS items_updated_at AFTER UPDATE ON items
FOR EACH ROW
BEGIN
  UPDATE items SET updated_at = datetime('now') WHERE id = NEW.id;
END;
`;

db.exec(SCHEMA);

const itemsCols = db
  .query<{ name: string }, []>("PRAGMA table_info(items)")
  .all()
  .map((r) => r.name);
if (!itemsCols.includes("sort_order")) {
  db.exec("ALTER TABLE items ADD COLUMN sort_order INTEGER");
}

export function logAudit(itemId: number | null, eventType: string, details?: unknown): void {
  db.query("INSERT INTO audit_log (item_id, event_type, details) VALUES (?, ?, ?)").run(
    itemId,
    eventType,
    details == null ? null : JSON.stringify(details),
  );
}
