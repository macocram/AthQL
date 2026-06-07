#!/usr/bin/env bash
# Sync root VERSION into frontend/package.json (and lockfile version field).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo "VERSION must be semver (e.g. 1.0.0), got: $VERSION" >&2
  exit 1
fi

node -e "
const fs = require('fs');
const path = require('path');
const root = process.argv[1];
const version = process.argv[2];
for (const file of ['frontend/package.json', 'frontend/package-lock.json']) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  json.version = version;
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}
" "$ROOT" "$VERSION"

PYTHONPATH="$ROOT/backend" python3 -c "
from app.version import __version__
import sys
expected = sys.argv[1]
assert __version__ == expected, (__version__, expected)
print('Backend reads VERSION:', __version__)
" "$VERSION"

echo "Synced version $VERSION to frontend/package.json"
