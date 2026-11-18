#!/usr/bin/env bash
# Deploy the current checkout to the existing CHILE2 Railway service.
set -euo pipefail
railway_bin="${RAILWAY_BIN:-railway}"
if ! command -v "$railway_bin" >/dev/null 2>&1; then
  echo "Railway CLI is required. Install @railway/cli or set RAILWAY_BIN to its path." >&2
  exit 1
fi
npm run type-check
npm run lint
npm test -- --runInBand
echo "Deploying CHILE2 to Railway production. Existing databases are never reset by this script."
"$railway_bin" up --project aed10739-3d02-4703-955a-2c01935acf82 --environment production --service chile2 --detach
