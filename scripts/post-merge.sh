#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Schema changes are a separately reviewed and explicitly approved operation.
# Never push a schema or run migrations automatically after a merge.
