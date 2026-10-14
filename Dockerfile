# syntax=docker/dockerfile:1

# One image: the Express API (bundled by esbuild) plus the built Vite SPA,
# which the API serves from the same origin via STATIC_DIR. The SPA calls the
# API at /api, so no cross-origin or proxy config is needed in production.
ARG NODE_VERSION=22-alpine

# ---- Build stage ----
FROM node:${NODE_VERSION} AS build
# libc6-compat/vips deps for sharp's native binary; git for any VCS metadata.
RUN apk add --no-cache libc6-compat vips-dev
WORKDIR /build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN corepack enable

COPY . .
# Not --immutable: the committed yarn.lock is generated on the host platform;
# the Linux build resolves its own platform-specific optional deps (e.g. sharp).
RUN yarn install

# VITE_* public config is inlined at build time. CI writes
# artifacts/agri-market/.env.production.local from secrets before building;
# otherwise the committed artifacts/agri-market/.env provides defaults.
RUN yarn workspace @workspace/api-server run build \
 && yarn workspace @workspace/agri-market run build

# ---- Runtime stage ----
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache libc6-compat vips
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public

# Bundled server + the native deps esbuild externalizes (sharp, pg-native…).
COPY --from=build /build/node_modules /app/node_modules
COPY --from=build /build/artifacts/api-server/dist /app/server/dist
COPY --from=build /build/artifacts/agri-market/dist/public /app/public

EXPOSE 3000
CMD ["node", "--enable-source-maps", "/app/server/dist/index.mjs"]
