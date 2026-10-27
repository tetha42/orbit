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

# 2. Push current branch to remote
echo -e "${CYAN}==> [1/4] Pushing branch '${CURRENT_BRANCH}' to GitHub...${NC}"
git push origin "$CURRENT_BRANCH"
echo -e "${GREEN}✓ Branch synchronized.${NC}\n"

# 3. Clean up any existing local tag with the same name
echo -e "${CYAN}==> [2/4] Preparing local tag...${NC}"
git tag -d "$TAG" 2>/dev/null || true

# 4. Create annotated tag
echo -e "${CYAN}==> [3/4] Creating annotated tag: ${TAG}...${NC}"
git tag -a "$TAG" -m "$MSG"
echo -e "${GREEN}✓ Annotated tag created on HEAD.${NC}\n"

# 5. Push only this tag to GitHub
echo -e "${CYAN}==> [4/4] Pushing tag '${TAG}' to GitHub (--force)...${NC}"
git push origin "$TAG" --force
echo -e "${GREEN}✓ Tag pushed to GitHub.${NC}\n"

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  ✓ SUCCESS: Release ${TAG} is live on GitHub!${NC}"
echo -e "${GREEN}================================================================${NC}\n"
