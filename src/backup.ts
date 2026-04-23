import { $ } from "bun";
import { mkdirSync } from "node:fs";
import { env, loadConfig } from "./config.ts";
import { logAudit } from "./db.ts";

export interface BackupResult {
  file: string;
  rsynced: boolean;
  pruned: number;
}

export async function runBackup(): Promise<BackupResult> {
  const config = loadConfig();
  mkdirSync(env.backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = `${env.backupDir}/cairn-${ts}.sqlite`;

  // SQLite's .backup is concurrency-safe; preferred over cp.
  await $`sqlite3 ${env.dbPath} ".backup ${file}"`.quiet();

  // Local rotation: keep N newest.
  const keep = Math.max(1, config.backup.retention_count);
  const list = await $`ls -1t ${env.backupDir}/cairn-*.sqlite 2>/dev/null || true`.text();
  const files = list.split("\n").filter(Boolean);
  const toPrune = files.slice(keep);
  for (const old of toPrune) {
    await $`rm -f ${old}`.quiet();
  }

  // rsync to remote (optional)
  let rsynced = false;
  if (env.backupTarget) {
    await $`rsync -a --delete ${env.backupDir}/ ${env.backupTarget}`.quiet();
    rsynced = true;
  }

  logAudit(null, "backup", { file, rsynced, pruned: toPrune.length });
  return { file, rsynced, pruned: toPrune.length };
}
