#!/usr/bin/env bash
#
# Regenerates the API contract and the typed client built from it.
#
#   1. boots the backend against a throwaway PostgreSQL and writes the OpenAPI
#      document it serves to packages/api-client/openapi.json
#   2. regenerates packages/api-client/src/schema.d.ts from that document
#
# Both outputs are committed. CI runs this and fails if anything changed, so the
# contract between the services cannot drift silently.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "==> Generating the OpenAPI document from the backend"
(cd apps/api && ./mvnw -B -q test -Dtest=OpenApiContractTest -Dgmc.contract.write=true -DfailIfNoTests=false)

echo "==> Generating typed client definitions from the document"
pnpm --filter @gmc/api-client generate

echo "==> Done"
echo "    packages/api-client/openapi.json"
echo "    packages/api-client/src/schema.d.ts"
