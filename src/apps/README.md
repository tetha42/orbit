# Mini-Application Registry (`src/apps/`)

Each directory under `src/apps/<id>/` defines one mini-application. **One file — `manifest.ts` — is the single source of truth** describing the app's desktop window, dock/launcher placement, keyboard shortcut, menu bar items, role permissions, notification filters, and lazy-loaded React component.

> To see all currently registered app manifests and permission summaries, read **[`docs/generated/SURFACES.md`](../../docs/generated/SURFACES.md)**.

---

## 1. Registering an App (`manifest.ts` + `<id>.contract.json`)

Create `src/apps/<id>/manifest.ts` exporting an `AppManifest` (`WindowManifest` or `PermissionOnlyManifest` from `@/core/apps/manifest`) as `default`, along with `<id>.contract.json` documenting the app's tables, API base, limits, and error codes:

```ts
import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'polls',
	title: 'Community Polls',
	shortTitle: 'Polls',
	description: 'Create and vote on organization-wide polls.',
	en: {
		title: 'Community Polls',
		shortTitle: 'Polls',
		description: 'Create and vote on organization-wide polls.',
	},
	tr: {
		title: '<Turkish title>',
		shortTitle: '<Turkish short title>',
		description: '<Turkish description>',
	},
	category: 'Community',
	icon: 'BarChart3',
	accentColor: '#007aff',
	window: { width: 760, height: 520, minWidth: 580, minHeight: 420, x: 180, y: 110 },
	component: { module: './index', export: 'PollsApp' },
	order: 12,
	permission: {
		name: 'Polls',
		use: 'View open polls and cast a vote.',
		manage: 'Create, close, and export poll results.',
	},
} as const satisfies AppManifest;

export default manifest;
```

### Pure Manifest Rules

`manifest.ts` is imported directly by Node generators (`scripts/gen-apps.mjs`, `scripts/gen-ai-index.mjs`, `scripts/gen-docs.mjs`) and server RBAC logic:

- **No UI or browser imports:** Do not import React, CSS modules, browser globals, or client state in `manifest.ts` (enforced by `scripts/check-pure.mjs`).
- **Two manifest shapes (`AppManifest`):**
  - `WindowManifest` — User-facing app (or `internal: true` for system-managed windows such as `mediaviewer`, which opens programmatically without dock/launcher/Spotlight entries).
  - `PermissionOnlyManifest` — Omit `window` to register RBAC permissions in the role editor before building a window UI.
- **Permission levels:** Roles grant `'none' | 'use' | 'manage'` per `appId`. Use `everyoneOpen: true` inside `permission` only for apps every enrolled member can open (e.g., `settings`).

---

## 2. Regenerating Registry, Contracts & Docs

After creating or editing a `manifest.ts` or `*.contract.json`, run:

```bash
pnpm gen:apps
```

This runs three generators (`scripts/gen-apps.mjs`, `scripts/gen-ai-index.mjs`, `scripts/gen-docs.mjs`) to refresh:
- `src/apps/registry.gen.ts` (client/server manifest registry and lazy imports)
- `AI_INDEX.json` (contracts + full API route + schema index)
- `docs/generated/{SCHEMA,API,SURFACES}.md`

Finally, run `pnpm verify` (`tsc --noEmit && eslint --cache . && pnpm check`) before committing.

---

## 3. Beyond the Manifest

`manifest.ts` wires UI chrome and RBAC metadata; implementing an end-to-end mini-app typically also adds:
- Server route handlers (`src/app/api/<id>/route.ts`) guarded with `requireApp('<id>', 'use' | 'manage')` and `withAudit(...)`
- PostgreSQL table(s) under `src/db/schema/init/` and domain repository helpers under `src/db/repositories/`
- Typed English/Turkish UI copy under `src/lib/i18n/extra/`
- Contract tests (`tests/contract/`) and optional Playwright E2E coverage (`tests/e2e/ui/suites/`)

See **[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)** and **[`AGENTS.md`](../../AGENTS.md)** for full platform conventions.
