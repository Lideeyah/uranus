# Uranus bridge server — Fly.io production image
# Runs the WebSocket + HTTP bridge (src/server/bridge-server.ts) that the Vercel
# frontend and any MCP-compliant client (e.g. Claude Desktop via mcp-bridge) talk to.

FROM node:22-slim AS base

# Enable pnpm-free npm ci with production+dev deps (tsx needed at runtime).
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json ./
# Install prod + dev deps because bridge-server.ts runs via `tsx` (a devDep) and
# imports @modelcontextprotocol/sdk + ws + openai (prod deps).
RUN npm ci --no-audit --no-fund

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production \
    URANUS_BRIDGE_PORT=3223 \
    URANUS_TIMEOUT_MS=120000

# Non-root user for defense in depth.
RUN useradd --user-group --create-home --shell /bin/false uranus

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

# Persistent state directory (mounted as a Fly volume in production).
RUN mkdir -p /app/.uranus && chown -R uranus:uranus /app

USER uranus

EXPOSE 3223

# tsx runs the TS entry directly. No prebuild step needed for a single-file server.
CMD ["node", "--experimental-strip-types=false", "./node_modules/tsx/dist/cli.mjs", "src/server/bridge-server.ts"]
