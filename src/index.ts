import { Hono } from "hono";
import { logger } from "hono/logger";
import { env, loadConfig } from "./config.ts";
import { bearerAuth } from "./auth.ts";
import { startScheduler } from "./scheduler.ts";
import healthRoute from "./routes/health.ts";
import itemsRoute from "./routes/items.ts";
import digestRoute from "./routes/digest.ts";
import auditRoute from "./routes/audit.ts";
import routineRoute from "./routes/routine.ts";

// Load config eagerly so a malformed/missing config fails at startup.
loadConfig();

const app = new Hono();
app.use("*", logger());

app.route("/health", healthRoute);

const api = new Hono();
api.use("*", bearerAuth);
api.route("/items", itemsRoute);
api.route("/digest", digestRoute);
api.route("/audit", auditRoute);
api.route("/routine", routineRoute);
app.route("/api", api);

// Static frontend
app.get("/", async () => {
  const raw = await Bun.file("public/index.html").text();
  const uiConfig = JSON.stringify({
    headerMorningCoffee: env.headerMorningCoffee,
    headerTheCairn: env.headerTheCairn,
  });
  const html = raw.replace(
    "</head>",
    `<script>window.CAIRN_UI=${uiConfig};</script></head>`,
  );
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
app.get("/favicon.svg", () => new Response(Bun.file("public/favicon.svg")));
app.get("/static/:file{.+}", async (c) => {
  const file = c.req.param("file");
  const candidate = Bun.file(`public/${file}`);
  if (!(await candidate.exists())) return c.notFound();
  return new Response(candidate);
});

startScheduler();

Bun.serve({
  port: env.port,
  hostname: env.bind,
  fetch: app.fetch,
});

console.log(`Cairn listening on http://${env.bind}:${env.port}`);
