# syntax=docker/dockerfile:1
#
# Build context is the repository root, not this directory: the app is a
# workspace package and its token layer imports the design system from
# ../../mockups-and-design-system.

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo

# Manifests first, so a source change does not re-resolve the dependency graph.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN --mount=type=cache,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --filter @gmc/web...

COPY packages/ packages/
COPY apps/web/ apps/web/
# The design system is a build input: it is the source of truth for every token
# the stylesheet resolves.
COPY mockups-and-design-system/design_system/ mockups-and-design-system/design_system/

RUN pnpm --filter @gmc/web build

FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/web/dist /srv
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
