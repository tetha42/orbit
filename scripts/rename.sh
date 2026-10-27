#!/usr/bin/env bash
# Orbit Community OS — Automated Identifier Replacer
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"
node "$SCRIPT_DIR/refactor-rename.mjs" "$@"
