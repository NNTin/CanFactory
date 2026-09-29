FROM node:22.22.3-trixie-slim@sha256:8cd0ffd483b64585c6d135364bea5f937ff40cd3da431789af011f9ee8d55af0 AS node

FROM node AS build
WORKDIR /app
COPY docker/debian.sources /etc/apt/sources.list.d/debian.sources
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
RUN npm ci
COPY . .
# The commit the web app shows in its footer (the build context has no .git).
ARG GIT_COMMIT_SHA=""
RUN npm run build

FROM node AS api
LABEL org.opencontainers.image.source="https://github.com/NNTin/CanFactory"
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATA_DIR=/data PROJECT_ROOT=/app NODE_ENV=production HOST=0.0.0.0
CMD ["node", "--import", "tsx", "apps/api/src/main.ts"]

FROM openscad/openscad:dev.2026-01-19@sha256:0af06bc2aa7a45d18b01a23cfb9dae6dddcd9542611e7be50edea6beb3b52fa7 AS worker
LABEL org.opencontainers.image.source="https://github.com/NNTin/CanFactory"
WORKDIR /app
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=build /app /app
RUN mkdir -p /data && chown 1000:1000 /data
USER 1000:1000
ENV DATA_DIR=/data PROJECT_ROOT=/app NODE_ENV=production QT_QPA_PLATFORM=offscreen
CMD ["node", "--import", "tsx", "apps/worker/src/main.ts"]

FROM nginx:1.28.3-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236 AS web
LABEL org.opencontainers.image.source="https://github.com/NNTin/CanFactory"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
