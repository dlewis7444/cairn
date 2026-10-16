# Cairn

A small, self-hosted watchlist and daily-poke for things you want to keep an eye on — bills you're expecting, orders you need to adjust, appointments you need to make. Not a to-do list; a set of stones you've stacked along the trail and glance at every morning with a cup of coffee.

Cairn sends one email every morning with whatever is imminent, and links to a web page where you can manage the list, snooze items, demote them to "Maybe I Might," or archive them.

## Stack

- Runtime: [Bun](https://bun.com) 1.3+
- API: [Hono](https://hono.dev) on Bun
- Storage: `bun:sqlite`
- Scheduler: [Croner](https://github.com/Hexagon/croner)
- Email: [Nodemailer](https://nodemailer.com)
- Config: TOML (`config/config.toml`) + dotenv (`.env.local`)

## First-time setup

Requires [Bun 1.3+](https://bun.sh/docs/installation); `npm start` cannot run Cairn.

```bash
cp .env.example .env.local  # then set CAIRN_BEARER_TOKEN; SMTP is optional
cp config/config.example.toml config/config.toml
bun install
bun run start
```

Open `http://127.0.0.1:3847` (or the port in `CAIRN_PORT`). At the `Bearer token (one-time):` prompt, enter your `CAIRN_BEARER_TOKEN`; a wrong token reloads the page and asks again. Cairn uses one shared token and is intended for a personal install.

Mail is optional: leave `SMTP_TO` empty to disable it. Gmail requires an app password, with `SMTP_FROM` set to that account or one of its aliases.

For native backups, install the `sqlite3` CLI on `PATH`. A missing CLI is logged without crashing the server; the Docker image already includes it.

For Docker, create and edit the same environment and config files first—Compose requires `.env.local`, and Cairn requires `config/config.toml`:

```bash
cp .env.example .env.local
cp config/config.example.toml config/config.toml
docker compose up
```

Auto mode in the item form is unfinished: Playwright and AI are stubs. The only script runner is `headlines`, which requires `CAIRN_SEARXNG_URL`.

## Deploy

Cairn is one Bun process. Copy `.env.example` to `.env.local` and set the bearer token, SMTP settings if you want mail, and an optional backup target. `CAIRN_SEARXNG_URL` is optional; leave it blank to disable the headlines runner. Set `CAIRN_TZ` to an IANA timezone.

`docker-compose.yml` is a sample container definition. `.gitlab-ci.yml` deploys over SSH. Put `CAIRN_DEPLOY_HOST`, `CAIRN_DEPLOY_USER`, and `CAIRN_DEPLOY_SSH_KEY` in CI variables, not in the repo.

## License

MIT — see [LICENSE](LICENSE).
