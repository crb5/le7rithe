#!/bin/bash
set -e
yarn install --immutable
echo "Skipping automatic database push. Confirm the development database target, then run 'yarn workspace @workspace/db run push' manually when a schema update is required."
