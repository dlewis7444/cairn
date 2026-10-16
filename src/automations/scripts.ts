import { env } from "../config.ts";
import type { RecheckResult } from "./index.ts";

type ScriptFn = (cfg: Record<string, unknown>) => Promise<RecheckResult>;

async function headlines(cfg: Record<string, unknown>): Promise<RecheckResult> {
  const query = (cfg.query as string | undefined) ?? "top news headlines today";
  const count = Math.min(Number(cfg.count ?? 5), 20);
  if (!env.searxngUrl) {
    return { ok: false, status: "CAIRN_SEARXNG_URL is not set" };
  }
  const url = `${env.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=news&time_range=day`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return { ok: false, status: `searxng ${res.status}` };
  }
  const body = (await res.json()) as { results?: Array<{ title?: string }> };
  const titles = (body.results ?? [])
    .map((r) => (r.title ?? "").trim())
    .filter((t) => t.length > 0)
    .slice(0, count);
  if (titles.length === 0) {
    return { ok: false, status: "no results" };
  }
  const notesUpdate = titles.map((t) => `• ${t}`).join("\n");
  return {
    ok: true,
    status: `ok (${titles.length} headlines)`,
    notesUpdate,
  };
}

export const scripts: Record<string, ScriptFn> = {
  headlines,
};
