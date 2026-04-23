import type { Context, Next } from "hono";
import { env } from "./config.ts";

export async function bearerAuth(c: Context, next: Next) {
  if (!env.bearerToken) {
    return c.json({ error: "Server misconfigured: CAIRN_BEARER_TOKEN not set" }, 500);
  }
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = header.slice(7);
  if (!constantTimeEqual(token, env.bearerToken)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
