# Cairn — Roadmap

A lightweight, living list of features we'd like to add to Cairn. One entry per idea, in plain words. Not a commitment, not a changelog (that's `git log`) — just a place to park things we've talked about so they don't get lost between sessions.

## Planned / Ideas

### Simple journal
A lightweight journal for Cairn — a place to jot a few lines per day that aren't to-dos or watchlist items. Should stay true to Cairn's calm, low-pressure feel: no streaks, no word counts, no "you haven't written in 3 days" guilt. Just a quiet daily page tied to the same morning-coffee moment.

## Maybes

Things we've talked about before and haven't ruled out, but haven't committed to building. Mirrored from the Phase-2 backlog in `CLAUDE.md` — that file stays the source of truth for what's *shipped* vs. *in-flight*; this section is just the idea parking lot.

### Playwright auto-check runner
Second runner type for the auto-check system (first is `script`, via SearXNG). Needs a browser baked into the container image. Would let items re-check themselves against page-rendered sources, not just API/script returns.

### AI auto-check runner + provider wiring
The `[ai]` + `[ai.providers.*]` TOML scaffold already exists in `config/config.toml`, but the runtime doesn't parse it yet. Needs the scaffold actually loaded at startup plus an LLM client so items can use AI-driven rechecks.

### Amazon/Walmart Gmail parser
Nightly job scraping Gmail for shipped/delivered notices on orders being watched. Would share the Google-auth plumbing already built for the outbound SMTP work.

### AI provider config UI
Surface `[ai.providers.*]` and a default-provider picker in the web UI, so the TOML scaffold becomes user-configurable without editing files.

### Second-tier micro-interactions
More of the small decorative cairn-themed touches (like the 🪨 drop-and-settle on routine DONE) — only if any current interaction feels missing.