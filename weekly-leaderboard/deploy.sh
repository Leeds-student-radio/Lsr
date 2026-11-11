#!/usr/bin/env bash
set -euo pipefail
LSR_DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null; then
  echo "Node.js 22 or later is required."
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Use Node.js 22 or later."); process.exit(1); }'
if ! npm ls --prefix "$LSR_DEPLOY_DIR/functions" --depth=0 >/dev/null 2>&1; then
  npm ci --prefix "$LSR_DEPLOY_DIR/functions" --ignore-scripts
fi
exec node "$LSR_DEPLOY_DIR/functions/scripts/deploy.js" "$@"
