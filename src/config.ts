import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import type { AppConfig } from "./types.ts";

const CONFIG_PATH = process.env.CAIRN_CONFIG_PATH ?? "config/config.toml";

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  cached = parseToml(raw) as unknown as AppConfig;
  return cached;
}

export function reloadConfig(): AppConfig {
  cached = null;
  return loadConfig();
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: intEnv("CAIRN_PORT", 3847),
  bind: process.env.CAIRN_BIND ?? "0.0.0.0",
  tz: process.env.CAIRN_TZ ?? "UTC",
  bearerToken: process.env.CAIRN_BEARER_TOKEN ?? "",
  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: intEnv("SMTP_PORT", 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "",
    to: process.env.SMTP_TO ?? "",
  },
  backupTarget: process.env.BACKUP_RSYNC_TARGET ?? "",
  publicUrl: (process.env.CAIRN_PUBLIC_URL ?? "").replace(/\/$/, ""),
  dbPath: process.env.CAIRN_DB_PATH ?? "data/cairn.sqlite",
  backupDir: process.env.CAIRN_BACKUP_DIR ?? "backups",
};
