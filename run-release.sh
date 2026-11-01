#!/usr/bin/env bash
# ==============================================================================
# Orbit Community OS — Release Dispatcher
# ==============================================================================
# Triggers `make release` for v2.0.0 with full verification checks.
# ==============================================================================

set -euo pipefail

TAG="${1:-v2.0.0}"
MSG="${2:-Orbit Community OS v2.0.0 — Security Hardening, Canonical APIs & SoC Changelog UX}"

echo "================================================================"
echo "  Deploying Orbit Community OS Release: ${TAG}"
echo "================================================================"
echo "  Target Tag:  ${TAG}"
echo "  Description: ${MSG}"
echo "----------------------------------------------------------------"

# Run make release
make release TAG="${TAG}" MSG="${MSG}"
