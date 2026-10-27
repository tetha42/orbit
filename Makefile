.PHONY: help install setup dev build start lint typecheck verify test-e2e clean \
        db-up db-reset db-shell db-backup \
        compose-up compose-down compose-logs compose-build docker-build \
        up down logs pull update release-bundle release push

# Terminal colors
CYAN  := \033[36m
GREEN := \033[32m
RESET := \033[0m

DB_CONTAINER := orbit-db
# Override with `make db-shell POSTGRES_USER=... POSTGRES_DB=...`
DB_USER      := $(if $(POSTGRES_USER),$(POSTGRES_USER),orbit)
DB_NAME      := $(if $(POSTGRES_DB),$(POSTGRES_DB),orbit)
BACKUP_DIR   := backups
COMPOSE      := docker compose -f infra/docker/docker-compose.yml

help:
	@printf "\n"
	@printf "  $(CYAN)[Orbit Community OS by tetha42 — Digital Workspace & R&D Suite]$(RESET)\n\n"
	@printf "  $(GREEN)make install$(RESET)         Install project dependencies (pnpm install)\n"
	@printf "  $(GREEN)make setup$(RESET)           One-command developer setup & verification wizard\n"
	@printf "  $(GREEN)make dev$(RESET)             Start development server (:3000)\n"
	@printf "  $(GREEN)make verify$(RESET)          Run typecheck + lint (pre-commit quality gate)\n"
	@printf "  $(GREEN)make test-e2e$(RESET)        Run end-to-end security & XP simulation suite\n"
	@printf "  $(GREEN)make lint$(RESET)            Run ESLint checks\n"
	@printf "  $(GREEN)make typecheck$(RESET)       Run TypeScript compiler check\n"
	@printf "  $(GREEN)make build$(RESET)           Build production bundle\n"
	@printf "  $(GREEN)make clean$(RESET)           Clear build caches\n\n"
	@printf "  $(CYAN)Database (PostgreSQL)$(RESET)\n"
	@printf "  $(GREEN)make db-up$(RESET)           Start PostgreSQL container (:5432)\n"
	@printf "  $(GREEN)make db-shell$(RESET)        Open interactive psql shell\n"
	@printf "  $(GREEN)make db-backup$(RESET)       Dump SQL backup into $(BACKUP_DIR)/\n"
	@printf "  $(GREEN)make db-reset$(RESET)        Reset database volume (clean slate)\n\n"
	@printf "  $(CYAN)Docker & Production Deployment$(RESET)\n"
	@printf "  $(GREEN)make up$(RESET)              Start database + Orbit OS stack (:3000)\n"
	@printf "  $(GREEN)make down$(RESET)            Stop all services safely\n"
	@printf "  $(GREEN)make logs$(RESET)            Follow live container logs\n"
	@printf "  $(GREEN)make update$(RESET)          Pull latest GHCR image and restart\n"
	@printf "  $(GREEN)make compose-build$(RESET)   Rebuild container image from local Dockerfile\n"
	@printf "  $(GREEN)make release-bundle$(RESET)  Generate release archives (.tar.gz)\n"
	@printf "  $(GREEN)make push$(RESET)            Push current branch to GitHub\n"
	@printf "  $(GREEN)make release TAG=v..$(RESET) Tag and publish a Git release\n\n"

# ==================== Application & Setup ====================

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

# Runs both gates. This is what CI and the Docker build call.
verify:
	pnpm verify

test-e2e:
	@node scripts/e2e-simulation.mjs

clean:
	rm -rf .next tsconfig.tsbuildinfo
	@echo "[OK] Build caches cleared."

# ==================== Database ====================
# PostgreSQL is the primary store. Settings are managed via the Orbit Web UI.

db-up:
	$(COMPOSE) up -d db
	@echo "[OK] PostgreSQL is ready on :5432."

db-shell:
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)

db-backup:
	@./infra/scripts/db-backup.sh $(BACKUP_DIR)

db-reset:
	$(COMPOSE) down -v
	$(COMPOSE) up -d db
	@echo "[OK] PostgreSQL reset complete. Tables initialize automatically on first request."

# ==================== Docker & Infrastructure ====================

compose-up:
	$(COMPOSE) up -d
	@echo "[OK] Orbit Community OS is running at http://localhost:3000"

compose-build:
	$(COMPOSE) build --no-cache
	@echo "[OK] Container image rebuilt."

compose-down:
	$(COMPOSE) down
	@echo "[OK] All services stopped."

compose-logs:
	$(COMPOSE) logs -f

docker-build:
	docker build -f infra/docker/Dockerfile -t orbit-os:latest .

up: compose-up

down: compose-down

logs: compose-logs

pull:
	$(COMPOSE) pull

update:
	$(COMPOSE) pull
	$(COMPOSE) up -d
	@echo "[OK] Update complete!"

release-bundle:
	@node scripts/package-release.mjs

release:
	@bash scripts/release.sh "$(TAG)" "$(MSG)"

push:
	@CURRENT_BRANCH=$$(git branch --show-current); \
	echo "==> Pushing branch '$${CURRENT_BRANCH}' to GitHub..."; \
	git push origin "$${CURRENT_BRANCH}"
