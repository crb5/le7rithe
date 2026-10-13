#!/bin/bash
set -e
pnpm install --frozen-lockfile
echo "Skipping automatic database push. Confirm the development database target, then run 'pnpm --filter db push' manually when a schema update is required."
