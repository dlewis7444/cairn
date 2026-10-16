# --- deps stage: install production dependencies only -----------------------
FROM oven/bun:1.4.3-alpine@sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime stage -----------------------------------------------------------
FROM oven/bun:1.4.3-alpine@sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373
WORKDIR /app

# sqlite3 CLI for the .backup operation, rsync for backup shipping,
# openssh-client for rsync-over-SSH.
RUN apk add --no-cache sqlite rsync openssh-client tzdata

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY public ./public
# Keep the example outside /app/config. A volume on that path would hide it.
COPY config/config.example.toml /usr/share/cairn/config.example.toml
COPY docker/entrypoint.sh /usr/local/bin/cairn-entrypoint
RUN chmod +x /usr/local/bin/cairn-entrypoint

# Mount points for persistent state
VOLUME ["/app/data", "/app/backups", "/app/config"]

ENV CAIRN_BIND=0.0.0.0
ENV CAIRN_PORT=3847
EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O- http://127.0.0.1:3847/health || exit 1

ENTRYPOINT ["/usr/local/bin/cairn-entrypoint"]
CMD ["bun", "src/index.ts"]
