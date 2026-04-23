import type { Item } from "../types.ts";

export interface RecheckResult {
  ok: boolean;
  status: string;
  details?: unknown;
}

// MVP stub: logs what it would have done, never executes.
// Phase 2 will dispatch on item.automation_type to real runners
// (script | playwright | ai). Each runner reads automation_config JSON.
export async function runRecheck(item: Item): Promise<RecheckResult> {
  if (item.mode !== "auto") {
    return { ok: false, status: "skipped (manual item)" };
  }
  return {
    ok: false,
    status: `stub — would run ${item.automation_type ?? "unknown"}`,
    details: {
      automation_type: item.automation_type,
      automation_config: item.automation_config,
    },
  };
}
