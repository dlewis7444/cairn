import type { Item } from "../types.ts";
import { scripts } from "./scripts.ts";

export interface RecheckResult {
  ok: boolean;
  status: string;
  details?: unknown;
  notesUpdate?: string;
}

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function runRecheck(item: Item): Promise<RecheckResult> {
  if (item.mode !== "auto") {
    return { ok: false, status: "skipped (manual item)" };
  }
  const cfg = parseConfig(item.automation_config);

  if (item.automation_type === "script") {
    const name = (cfg.script as string | undefined) ?? "";
    const fn = scripts[name];
    if (!fn) return { ok: false, status: `unknown script: ${name || "(none)"}` };
    try {
      return await fn(cfg);
    } catch (err) {
      return { ok: false, status: `script error: ${String(err)}` };
    }
  }

  // playwright | ai — still stubbed
  return {
    ok: false,
    status: `stub — would run ${item.automation_type ?? "unknown"}`,
    details: {
      automation_type: item.automation_type,
      automation_config: item.automation_config,
    },
  };
}
