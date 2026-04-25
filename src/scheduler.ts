import { Cron } from "croner";
import { env, loadConfig } from "./config.ts";
import { sendDigest } from "./email.ts";
import { runBackup } from "./backup.ts";
import { db, logAudit } from "./db.ts";
import { runRecheck } from "./automations/index.ts";
import type { Item } from "./types.ts";

let jobs: Cron[] = [];

export function startScheduler(): void {
  stopScheduler();
  const config = loadConfig();

  jobs.push(
    new Cron(config.digest.schedule, { timezone: env.tz, name: "digest" }, async () => {
      try {
        await sendDigest();
      } catch (err) {
        logAudit(null, "digest_error", { error: String(err) });
      }
    }),
  );

  jobs.push(
    new Cron(config.backup.schedule, { timezone: env.tz, name: "backup" }, async () => {
      try {
        await runBackup();
      } catch (err) {
        logAudit(null, "backup_error", { error: String(err) });
      }
    }),
  );

  const autoItems = db
    .query<Item, []>(
      `SELECT * FROM items
       WHERE mode = 'auto'
         AND check_schedule IS NOT NULL
         AND list IN ('active', 'routine')`,
    )
    .all();
  for (const item of autoItems) {
    jobs.push(
      new Cron(
        item.check_schedule!,
        { timezone: env.tz, name: `recheck-${item.id}` },
        async () => {
          try {
            const result = await runRecheck(item);
            logAudit(item.id, "recheck_scheduled", result);
            if (result.notesUpdate != null) {
              db.query(
                `UPDATE items SET last_checked_at = datetime('now'), last_status = ?, notes = ? WHERE id = ?`,
              ).run(result.status, result.notesUpdate, item.id);
            } else {
              db.query(
                `UPDATE items SET last_checked_at = datetime('now'), last_status = ? WHERE id = ?`,
              ).run(result.status, item.id);
            }
          } catch (err) {
            logAudit(item.id, "recheck_error", { error: String(err) });
          }
        },
      ),
    );
  }
}

export function stopScheduler(): void {
  for (const j of jobs) j.stop();
  jobs = [];
}

export function rescheduleAll(): void {
  startScheduler();
}
