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

```bash
cp .env.example .env.local             # then fill in SMTP + bearer token
cp config/config.example.toml config/config.toml
bun install
bun run start
```

## Docker

```bash
docker compose up -d
```

Persistent data lives in the `data/` volume; backups land in `backups/`, which rsyncs to `BACKUP_RSYNC_TARGET` on the configured cron.

## License

MIT — see [LICENSE](LICENSE).
