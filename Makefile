.PHONY: help install setup doctor setup-url setup-reset dev build start lint typecheck verify \
        test test-security test-e2e e2e ci audit clean \
        db-up db-down db-status db-shell db-backup db-reset \
        up down logs pull update \
        local-build local-up local-down \
        release-bundle release push

# ==============================================================================
# Thin Human Facade over ./bin/orbit (NO silent DATABASE_URL overrides)
# ==============================================================================
CYAN    := \033[36m
GREEN   := \033[32m
YELLOW  := \033[33m
BOLD    := \033[1m
RESET   := \033[0m

ORBIT      := ./bin/orbit
BACKUP_DIR := backups

# Production compose (Coolify & Production default - pulls GHCR image, strict secrets)
COMPOSE_PROD  := docker compose -f infra/docker/docker-compose.yml

# Local testing compose (Builds from local Dockerfile)
COMPOSE_LOCAL := docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.build.yml

# ==============================================================================
# Help Menu
# ==============================================================================
help:
	@printf "\n"
	@printf "  $(BOLD)$(CYAN)Orbit Community OS — Development & Operations Hub$(RESET)\n"
	@printf "  $(YELLOW)Thin ergonomic shortcuts over ./bin/orbit & Docker Compose$(RESET)\n\n"
	@printf "  $(BOLD)Development & Code Quality$(RESET)\n"
	@printf "  $(GREEN)make install$(RESET)          Install dependencies (pnpm install)\n"
	@printf "  $(GREEN)make doctor$(RESET)           Check environment, config provenance, DB & setup status\n"
	@printf "  $(GREEN)make setup$(RESET)            Alias for make doctor\n"
	@printf "  $(GREEN)make setup-url$(RESET)        Print clickable /setup#token=... URL\n"
	@printf "  $(GREEN)make setup-reset$(RESET)      Reset local setup state (dev only, confirms)\n"
	@printf "  $(GREEN)make dev$(RESET)              Start local Next.js dev server (:3000)\n"
	@printf "  $(GREEN)make verify$(RESET)           Run all quality gates (TypeScript, ESLint, i18n, Pure, Tokens)\n"
	@printf "  $(GREEN)make test$(RESET)             Run API contract test suite\n"
	@printf "  $(GREEN)make test-security$(RESET)    Run WAF, Honeypot, Zero-Trust and security regression tests\n"
	@printf "  $(GREEN)make test-e2e$(RESET)         Run API/simulation E2E suite\n"
	@printf "  $(GREEN)make e2e$(RESET)              Run Playwright browser UI E2E suite\n"
	@printf "  $(GREEN)make ci$(RESET)               Run full CI pipeline locally\n"
	@printf "  $(GREEN)make build$(RESET)            Compile Next.js standalone production build\n"
	@printf "  $(GREEN)make clean$(RESET)            Clean Next.js build artifacts and cache directories\n\n"
	@printf "  $(BOLD)Dev Database (PostgreSQL — infra/docker/docker-compose.dev.yml)$(RESET)\n"
	@printf "  $(GREEN)make db-up$(RESET)            Start local dev PostgreSQL container (127.0.0.1:5432)\n"
	@printf "  $(GREEN)make db-down$(RESET)          Stop dev PostgreSQL container (preserves data)\n"
	@printf "  $(GREEN)make db-status$(RESET)        Show active DATABASE_URL source and container state\n"
	@printf "  $(GREEN)make db-shell$(RESET)         Open interactive psql terminal session in dev container\n"
	@printf "  $(GREEN)make db-backup$(RESET)        Save full SQL backup dump into $(BACKUP_DIR)/\n"
	@printf "  $(GREEN)make db-reset$(RESET)         Wipe dev DB volume and recreate fresh PostgreSQL\n\n"
	@printf "  $(BOLD)Local Docker Testing (Local Compose with Image Build)$(RESET)\n"
	@printf "  $(GREEN)make local-build$(RESET)      Build Docker image locally from scratch (no-cache)\n"
	@printf "  $(GREEN)make local-up$(RESET)         Build from local code and start full stack (DB + App)\n"
	@printf "  $(GREEN)make local-down$(RESET)       Stop local testing containers\n\n"
	@printf "  $(BOLD)Production & Deployment (GHCR / Coolify)$(RESET)\n"
	@printf "  $(GREEN)make up$(RESET)               Start production stack using official GHCR image\n"
	@printf "  $(GREEN)make down$(RESET)             Safely stop all production services\n"
	@printf "  $(GREEN)make logs$(RESET)             Stream live container logs (exit with Ctrl+C)\n"
	@printf "  $(GREEN)make update$(RESET)           Pull latest GHCR image and restart services\n"
	@printf "  $(GREEN)make release-bundle$(RESET)   Build official standalone & docker release archives (.tar.gz)\n"
	@printf "  $(GREEN)make release TAG=v...$(RESET) Create annotated tag and push branch + tag in one command\n\n"

# ==============================================================================
# Development & Code Quality
# ==============================================================================

install:
	pnpm install

doctor:
	@$(ORBIT) doctor

setup:
	@$(ORBIT) doctor

setup-url:
	@$(ORBIT) setup url

setup-reset:
	@$(ORBIT) setup reset

dev:
	@$(ORBIT) dev

build:
	pnpm build

start:
	pnpm start

lint:
	pnpm lint

typecheck:
	pnpm typecheck

verify:
	pnpm verify

test:
	pnpm test

audit:
	pnpm audit --prod --audit-level=high

test-security:
	pnpm test:security

test-e2e:
	pnpm test:e2e

e2e:
	pnpm e2e

ci:
	@printf "\n  $(BOLD)$(CYAN)Orbit Community OS — Local Full CI Pipeline Check$(RESET)\n"
	@printf "  $(YELLOW)Mirroring GitHub Actions CI/CD workflows locally...$(RESET)\n\n"
	@printf "  $(CYAN)[1/5] Running verification gate (TSC, ESLint, i18n, Tokens, Audit)...$(RESET)\n"
	@pnpm verify
	@printf "  $(GREEN)✓ Verification gate passed.$(RESET)\n\n"
	@printf "  $(CYAN)[2/5] Running high/critical dependency audit...$(RESET)\n"
	@pnpm audit --prod --audit-level=high
	@printf "  $(GREEN)✓ Dependency audit passed.$(RESET)\n\n"
	@printf "  $(CYAN)[3/5] Running autonomous cybersecurity & SOC E2E suite...$(RESET)\n"
	@pnpm test:security
	@printf "  $(GREEN)✓ Cybersecurity suite passed.$(RESET)\n\n"
	@printf "  $(CYAN)[4/5] Running API contract test suite...$(RESET)\n"
	@pnpm test
	@printf "  $(GREEN)✓ Contract test suite passed.$(RESET)\n\n"
	@printf "  $(CYAN)[5/5] Compiling Next.js production build...$(RESET)\n"
	@pnpm build
	@printf "\n  $(BOLD)$(GREEN)================================================================$(RESET)\n"
	@printf "  $(BOLD)$(GREEN)  ✓ ALL GITHUB ACTIONS CHECKS PASSED LOCALLY! READY FOR RELEASE$(RESET)\n"
	@printf "  $(BOLD)$(GREEN)================================================================$(RESET)\n\n"

clean:
	rm -rf .next tsconfig.tsbuildinfo dist-release
	@echo "✓ [OK] Build caches cleared."

# ==============================================================================
# Dev Database (PostgreSQL)
# ==============================================================================

db-up:
	@$(ORBIT) db up

db-down:
	@$(ORBIT) db down

db-status:
	@$(ORBIT) db status

db-shell:
	@$(ORBIT) db shell

db-backup:
	@./infra/scripts/db-backup.sh $(BACKUP_DIR)

db-reset:
	@$(ORBIT) db reset

# ==============================================================================
# Local Docker Testing (Local Source Build)
# ==============================================================================

local-build:
	$(COMPOSE_LOCAL) build --no-cache
	@echo "✓ [OK] Local Docker image built successfully."

local-up:
	$(COMPOSE_LOCAL) up -d --build
	@echo "✓ [OK] Locally built Orbit Community OS is running at http://localhost:3000"

local-down:
	$(COMPOSE_LOCAL) down
	@echo "✓ [OK] Local test services stopped."

# ==============================================================================
# Production & Deployment (GHCR / Coolify)
# ==============================================================================

up:
	$(COMPOSE_PROD) up -d
	@echo "✓ [OK] Orbit Community OS production stack started: http://localhost:3000"

down:
	$(COMPOSE_PROD) down
	@echo "✓ [OK] All services stopped."

logs:
	$(COMPOSE_PROD) logs -f

pull:
	$(COMPOSE_PROD) pull

update:
	$(COMPOSE_PROD) pull
	$(COMPOSE_PROD) up -d
	@echo "✓ [OK] Latest image pulled and services updated."

release-bundle:
	@node scripts/package-release.mjs

release:
	@bash scripts/release.sh "$(TAG)" "$(MSG)"

push:
	@CURRENT_BRANCH=$$(git branch --show-current); \
	echo "==> Pushing branch '$${CURRENT_BRANCH}' to GitHub..."; \
	git push origin "$${CURRENT_BRANCH}"
