# --- deps stage: install production dependencies only -----------------------
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime stage -----------------------------------------------------------
FROM oven/bun:1.3-alpine
WORKDIR /app

# sqlite3 CLI for the .backup operation, rsync for backup shipping,
# openssh-client for rsync-over-SSH.
RUN apk add --no-cache sqlite rsync openssh-client tzdata

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY public ./public
COPY config/config.example.toml ./config/config.example.toml

# Mount points for persistent state
VOLUME ["/app/data", "/app/backups", "/app/config"]

ENV CAIRN_BIND=0.0.0.0
ENV CAIRN_PORT=3847
EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O- http://127.0.0.1:3847/health || exit 1

CMD ["bun", "src/index.ts"]
