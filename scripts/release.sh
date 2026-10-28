#!/usr/bin/env bash
# ==============================================================================
# Orbit Community OS — Safe & Targeted Git Release Publisher
# ==============================================================================
# Usage:
#   make release TAG=v1.5.1 MSG="Release notes"
# or:
#   ./scripts/release.sh v1.5.1 "Release notes"
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TAG="${1:-${TAG:-}}"
shift || true
MSG="${*:-${MSG:-}}"

if [ -z "$TAG" ]; then
	echo -e "${RED}[ERROR] Release tag (TAG) was not specified!${NC}"
	echo -e "Usage:"
	echo -e "  ${CYAN}make release TAG=v1.5.1 MSG=\"Release notes\"${NC}"
	echo -e "  ${CYAN}./scripts/release.sh v1.5.1 \"Release notes\"${NC}"
	exit 1
fi

if [ -z "$MSG" ]; then
	MSG="Release $TAG"
fi

# 1. Working tree cleanliness check
if [ -n "$(git status --porcelain)" ]; then
	echo -e "${RED}[ERROR] Uncommitted changes detected in the working directory!${NC}"
	echo -e "${YELLOW}Please commit or stash your changes before releasing:${NC}"
	git status -s
	exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)

echo -e "\n${CYAN}================================================================${NC}"
echo -e "${CYAN}  Orbit Community OS — Release Publisher: ${GREEN}${TAG}${NC}"
echo -e "${CYAN}================================================================${NC}"
echo -e "  Branch:          ${GREEN}${CURRENT_BRANCH}${NC}"
echo -e "  Tag:             ${GREEN}${TAG}${NC}"
echo -e "  Description:     ${YELLOW}${MSG}${NC}"
echo -e "${CYAN}----------------------------------------------------------------${NC}\n"

# 2. Clean up any existing local tag with the same name
echo -e "${CYAN}==> [1/3] Preparing local tag...${NC}"
git tag -d "$TAG" 2>/dev/null || true

# 3. Create annotated tag
echo -e "${CYAN}==> [2/3] Creating annotated tag: ${TAG}...${NC}"
git tag -a "$TAG" -m "$MSG"
echo -e "${GREEN}✓ Annotated tag created on HEAD.${NC}\n"

# 4. Push branch and tag together in a single command to avoid double CI triggers
echo -e "${CYAN}==> [3/3] Pushing branch '${CURRENT_BRANCH}' and tag '${TAG}' to GitHub...${NC}"
git push origin "$CURRENT_BRANCH" "+refs/tags/$TAG"
echo -e "${GREEN}✓ Branch and tag pushed to GitHub.${NC}\n"

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  ✓ SUCCESS: Release ${TAG} is live on GitHub!${NC}"
echo -e "${GREEN}================================================================${NC}\n"
