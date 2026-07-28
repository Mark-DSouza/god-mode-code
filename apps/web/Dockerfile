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
# The root `prepare` script runs during the install below, even a filtered one,
# and points at this file. The image has no use for a git hook — the script
# sees no repository here and does nothing — but it has to exist for the
# install to succeed. It is copied rather than tolerated as missing, so that
# `prepare` failing anywhere else stays a failure rather than a shrug.
COPY scripts/install-git-hooks.sh scripts/
RUN --mount=type=cache,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --filter @gmc/web...

COPY packages/ packages/
COPY apps/web/ apps/web/
# The design system is a build input: it is the source of truth for every token
# the stylesheet resolves.
COPY mockups-and-design-system/design_system/ mockups-and-design-system/design_system/

# Error reporting, inlined into the bundle at build time. All of these are
# public by construction — a DSN is an ingestion address, not a credential — and
# every one of them is optional: with no DSN the bundle simply reports nothing,
# which is what a local build and anyone's fork should do.
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_ENVIRONMENT="production"
ARG VITE_COMMIT_SHA=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""

# The upload token is the one part that is a credential, so it arrives as a
# secret mount rather than as a build argument. A build argument is recorded in
# the image's own history, where anyone who can pull the image can read it.
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    pnpm --filter @gmc/web build

# Anything still here was not uploaded, because the upload deletes what it
# sends. Copying it into the served directory would publish the entire source of
# the application to every visitor — quietly, and only on builds where the
# upload token happened to be missing.
RUN find apps/web/dist -name '*.map' -delete

FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/web/dist /srv
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
