# Contributing to Orbit Community OS

## Before you start

- Use Node.js 22+ and pnpm.
- Read `AGENTS.md`, `docs/README.md`, and `docs/ARCHITECTURE.md`.
- Never commit `.env`, `config.ini`, `data/`, uploads, database dumps or real
  credentials.

## Local development

```bash
pnpm install
make db-up          # or: ./bin/orbit db up (isolated dev PostgreSQL on 127.0.0.1:5432)
make dev            # or: ./bin/orbit dev (prints /setup#token=... URL when unlocked)
```

Run `make doctor` (`./bin/orbit doctor`) to check environment health and config provenance, or `make setup-url` (`./bin/orbit setup url`) to retrieve the first-run `/setup` link.

## Quality gates

Every change must pass:

```bash
pnpm verify         # tsc --noEmit, eslint --cache ., and pnpm check (9 codegen/AST/length gates)
pnpm test           # contract test suite (tests/contract/*.test.mjs)
pnpm build          # production Next.js standalone build
```

For database, authentication, or UI changes, also run `pnpm test:security` and/or `pnpm e2e` (`tests/e2e/ui/README.md`) and add a regression test for the failure you are fixing.

## Architecture rules

- A mini-app is registered through `src/apps/<id>/manifest.ts`; do not edit
  generated registry/loader files by hand.
- Settings owns community policy; Members owns records; Teams owns teams;
  Account owns self-service. Do not create a second source of truth.
- All member, role, legal, team and committee writes must be auditable.
- Do not read PostgreSQL rows with raw snake_case property names: `getPgPool`
  returns camelCase keys. Use aliases or an explicit row mapper.
- Keep secrets out of logs, audit snapshots, queue payloads and API responses.
- New UI strings belong in both `tr` and `en` translations.

## Pull requests

Describe the user-visible change, data/migration impact, security implications
and verification commands. Keep unrelated refactors out of the same PR.
