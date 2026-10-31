# Contributing to Orbit Community OS

## Before you start

- Use Node.js 22+ and pnpm.
- Read `docs/ARCHITECTURE.md`, `docs/DATA_MODEL_ROADMAP.md` and
  `docs/ARCHITECTURE_AUDIT.md`.
- Never commit `.env`, `config.ini`, `data/`, uploads, database dumps or real
  credentials.

## Local development

```bash
pnpm install
pnpm dev
```

Use the Web Setup Wizard at `/setup` for the first run.

## Quality gates

Every change must pass:

```bash
pnpm typecheck
pnpm lint
pnpm check
pnpm build
```

For database or auth changes, also run the relevant integration/security tests
and add a regression test for the failure you are fixing.

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
