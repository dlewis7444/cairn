# Deploying Cairn

Cairn is one Bun process: API, web UI, scheduler, and morning digest all run in
it. This file covers persistent installs. For first-time setup (env file, config
file, bearer token), see [README.md](README.md).

## Environment files

Runtime settings live in `.env.local` at the install root (copy
`.env.example` to start) and in `config/config.toml` (copy
`config/config.example.toml`). Keep both out of version control.

Running `bun run start` (or `bun src/index.ts`), Bun auto-loads `.env.local`
from the process working directory — no flag needed, regardless of how the
process is started. The sample unit below sets `WorkingDirectory=/opt/cairn`,
so that auto-load would work under systemd too; it still passes the same file
explicitly via `EnvironmentFile=` so configuration does not depend on the
working directory. On a conflict, systemd-provided environment values take
precedence over Bun's dotenv values.

## Native install with systemd

`contrib/cairn.service` is a sample unit for a plain persistent install. It
runs Cairn as an unprivileged user from `/opt/cairn` and restarts on failure.

```bash
# One-time host prep (Debian/Ubuntu-flavored example):
sudo useradd --system --home /opt/cairn --shell /usr/sbin/nologin cairn
sudo mkdir -p /opt/cairn && sudo chown cairn:cairn /opt/cairn
# Clone or copy the repo into /opt/cairn, then as that user:
bun install
cp .env.example .env.local       # fill in CAIRN_BEARER_TOKEN, etc.
cp config/config.example.toml config/config.toml
chmod 600 .env.local

# Install and start the service:
sudo cp contrib/cairn.service /etc/systemd/system/cairn.service
sudo systemctl daemon-reload
sudo systemctl enable --now cairn
journalctl -u cairn -f           # logs
```

Adjust `User`/`Group`/`WorkingDirectory`/`EnvironmentFile` in the unit to match
your layout. Install the `sqlite3` CLI on the host for scheduled backups; a
missing CLI is logged without crashing the server.

## Data and backups

| What | Default location | Override |
|---|---|---|
| SQLite database | `data/cairn.sqlite` (under the install root) | `CAIRN_DB_PATH` |
| Local backups | `backups/` (under the install root) | `CAIRN_BACKUP_DIR` |

On the schedule in `config/config.toml` (`[backup]`), Cairn snapshots the
database with sqlite's `.backup`, keeps the newest `retention_count` copies in
the backup directory, and — only if `BACKUP_RSYNC_TARGET` is set — rsyncs the
directory there (e.g. `user@backup-host:/path/to/backups/`). Successes and
failures are recorded in the in-app audit log; failures are also printed to
stderr, which lands in the journal under systemd.

## Docker

Published images are at `ghcr.io/dlewis7444/cairn`. A push of a `vX.Y.Z` tag
builds `linux/amd64` and tags it as `X.Y.Z`, `X.Y`, and `latest`.
`docker-compose.yml` pulls `ghcr.io/dlewis7444/cairn:0.1.1`.

```bash
docker pull ghcr.io/dlewis7444/cairn:0.1.1
cp .env.example .env.local   # set CAIRN_BEARER_TOKEN; SMTP is optional
docker compose up
```

Compose reads `.env.local`. Named volumes persist `/app/data` and
`/app/backups`, and `./config` is mounted from the host. On startup the
container copies the bundled example to `config/config.toml` when that file
is absent, then leaves an existing file alone.

To build from this checkout instead of pulling:

```bash
docker build -t cairn:local .
```

## Continuous deployment

`.gitlab-ci.yml` is a generic SSH deploy job: on every push to `main` it
connects to `$CAIRN_DEPLOY_HOST` as `$CAIRN_DEPLOY_USER` with the private key
in `$CAIRN_DEPLOY_SSH_KEY` (set these as protected CI/CD variables, never in
the repo), pulls the checkout, restarts the `cairn` systemd unit, and checks
that it is active. Edit the `script:` commands to match your host.
