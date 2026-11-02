.PHONY: help install setup dev build start lint typecheck verify test test-security test-e2e ci audit clean \
        db-up db-down db-shell db-backup db-reset \
        up down logs pull update \
        local-build local-up local-down \
        release-bundle release push

# ==============================================================================
# Terminal Colors & Variables
# ==============================================================================
CYAN    := \033[36m
GREEN   := \033[32m
YELLOW  := \033[33m
BOLD    := \033[1m
RESET   := \033[0m

DB_CONTAINER := orbit-db
DB_USER      := $(if $(POSTGRES_USER),$(POSTGRES_USER),orbit)
DB_NAME      := $(if $(POSTGRES_DB),$(POSTGRES_DB),orbit)
DB_PASS      := $(if $(POSTGRES_PASSWORD),$(POSTGRES_PASSWORD),orbit_secret_2026)
DATABASE_URL ?= postgresql://$(DB_USER):$(DB_PASS)@localhost:5432/$(DB_NAME)
export DATABASE_URL
BACKUP_DIR   := backups

# Production compose (Coolify & Production default - pulls GHCR image, zero build overhead)
COMPOSE_PROD  := docker compose -f infra/docker/docker-compose.yml

# Local testing compose (Builds from local Dockerfile)
COMPOSE_LOCAL := docker compose -f infra/docker/docker-compose.yml
# ==============================================================================
# Help Menu
# ==============================================================================
help:
	@printf "\n"
	@printf "  $(BOLD)$(CYAN)Orbit Community OS — Development & Operations Hub$(RESET)\n"
	@printf "  $(YELLOW)Industrial-grade DevOps automation for local & production workflows$(RESET)\n\n"
	@printf "  $(BOLD)Development & Code Quality$(RESET)\n"
	@printf "  $(GREEN)make install$(RESET)          Install dependencies (pnpm install --frozen-lockfile)\n"
	@printf "  $(GREEN)make setup$(RESET)            Run automated developer setup & verification wizard\n"
	@printf "  $(GREEN)make dev$(RESET)              Start local Next.js development server (:3000)\n"
	@printf "  $(GREEN)make verify$(RESET)           Run all quality gates (TypeScript, ESLint, i18n, Pure, Tokens)\n"
	@printf "  $(GREEN)make test$(RESET)             Run API contract test suite (25 endpoints)\n"
	@printf "  $(GREEN)make test-security$(RESET)    Run WAF, Honeypot, Zero-Trust and security regression tests\n"
	@printf "  $(GREEN)make test-e2e$(RESET)         Run end-to-end user and simulation suites\n"
	@printf "  $(GREEN)make ci$(RESET)               Run full GitHub Actions CI/CD test pipeline locally\n"
	@printf "  $(GREEN)make build$(RESET)            Compile Next.js standalone production build\n"
	@printf "  $(GREEN)make clean$(RESET)            Clean Next.js build artifacts and cache directories\n\n"
	@printf "  $(BOLD)Database Management (PostgreSQL - Isolated Container)$(RESET)\n"
	@printf "  $(GREEN)make db-up$(RESET)            Start PostgreSQL container in the background (:5432)\n"
	@printf "  $(GREEN)make db-down$(RESET)          Stop PostgreSQL container (preserves data)\n"
	@printf "  $(GREEN)make db-shell$(RESET)         Open interactive psql terminal session\n"
	@printf "  $(GREEN)make db-backup$(RESET)        Save full SQL backup dump into $(BACKUP_DIR)/\n"
	@printf "  $(GREEN)make db-reset$(RESET)         Wipe database volume and start a fresh PostgreSQL instance\n\n"
	@printf "  $(BOLD)Local Docker Testing (Local Compose with Image Build)$(RESET)\n"
	@printf "  $(GREEN)make local-build$(RESET)      Build Docker image locally from scratch (no-cache)\n"
	@printf "  $(GREEN)make local-up$(RESET)         Build from local code and start full stack (DB + App)\n"
	@printf "  $(GREEN)make local-down$(RESET)       Stop local testing containers\n\n"
	@printf "  $(BOLD)Production & Deployment (Coolify / Pre-built GHCR Image)$(RESET)\n"
	@printf "  $(GREEN)make up$(RESET)               Start production stack using official GHCR image\n"
	@printf "  $(GREEN)make down$(RESET)             Safely stop all production services\n"
	@printf "  $(GREEN)make logs$(RESET)             Stream live container logs (exit with Ctrl+C)\n"
	@printf "  $(GREEN)make update$(RESET)           Pull latest GHCR image and restart services with zero-downtime\n"
	@printf "  $(GREEN)make release-bundle$(RESET)   Build official standalone & docker release archives (.tar.gz)\n"
	@printf "  $(GREEN)make release TAG=v...$(RESET) Create annotated tag and push branch + tag in one command\n\n"

# ==============================================================================
# Development & Code Quality
# ==============================================================================

install:
	pnpm install

setup:
	@node scripts/setup.mjs

dev:
	pnpm dev

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
	@node tests/simulation/e2e-simulation.mjs

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
# Database (PostgreSQL)
# ==============================================================================

db-up:
	$(COMPOSE_PROD) up -d db
	@echo "✓ [OK] PostgreSQL database is ready (localhost:5432)."

db-down:
	$(COMPOSE_PROD) stop db
	@echo "✓ [OK] PostgreSQL container stopped."

db-shell:
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)

db-backup:
	@./infra/scripts/db-backup.sh $(BACKUP_DIR)

db-reset:
	$(COMPOSE_PROD) down -v
	$(COMPOSE_PROD) up -d db
	@echo "✓ [OK] Database reset complete. Tables will auto-initialize on first request."

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
