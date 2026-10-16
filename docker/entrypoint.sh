#!/bin/sh
# Seed config.toml on first start, then run the server.
# The example lives outside /app/config because a volume mounted there
# hides files baked into that directory.
set -eu

mkdir -p /app/config /app/data /app/backups

if [ ! -f /app/config/config.toml ]; then
  cp /usr/share/cairn/config.example.toml /app/config/config.toml
fi

exec "$@"
