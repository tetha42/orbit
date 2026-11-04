# Orbit Community OS — Developer Onboarding & Engineering Guide (v3.0)

This guide covers everything a software engineer needs to contribute to **Orbit Community OS** by **tetha42**: setting up a local workspace in under five minutes, using `Makefile` targets, understanding the **Embedded Microservice Mini-App Architecture**, building new self-contained mini-applications (`manifest.ts`), **Adding a New Language in a Single Pull Request (Zero-Friction Localization Guide)**, integrating desktop & touch context menus (`useContextMenu`), and passing the compile-time verification gates (`npm run verify`).

---

## Table of Contents

1. [5-Minute Developer Onboarding](#1-5-minute-developer-onboarding)
2. [Makefile & NPM Script Reference](#2-makefile--npm-script-reference)
3. [Embedded Microservice Mini-App Architecture](#3-embedded-microservice-mini-app-architecture)
4. [Creating a New Mini-App (`src/apps/<id>/`)](#4-creating-a-new-mini-app-srcappsid)
5. [Adding a New Language (Zero-Friction 1-PR Localization Guide)](#5-adding-a-new-language-zero-friction-1-pr-localization-guide)
6. [Context Menu Integration (`useContextMenu`)](#6-context-menu-integration-usecontextmenu)
7. [Architectural Boundaries & Coding Standards](#7-architectural-boundaries--coding-standards)
8. [Verification Gates & E2E Testing (`npm run verify`)](#8-verification-gates--e2e-testing-npm-run-verify)

---

## 1. 5-Minute Developer Onboarding

Orbit Community OS follows a **Zero Config Files** workflow even in local development:

```bash
# 1. Clone the repository
git clone https://github.com/tetha42/orbit.git
cd orbit

# 2. Install dependencies
npm install
# (or: pnpm install)

# 3. Start the PostgreSQL 16 container on port 5432
make db-up

# 4. Start the Next.js 16 Turbopack dev server on port 3000
make dev
```

Open `http://localhost:3000`. If your local PostgreSQL database is empty, the **Web UI Setup Wizard (`/setup`)** opens automatically so you can bind `postgresql://orbit:<your-password>@localhost:5432/orbit`, choose your Organization Archetype (`academic_club`, `dao_collective`, `research_lab`, or `professional_guild`), and create your local administrator account in seconds.

> [!IMPORTANT]
> **Next.js 16 Notice:** As noted in `AGENTS.md`, this codebase runs on **Next.js 16.3+ (App Router)**. Before using framework-specific APIs, consult `node_modules/next/dist/docs/` to ensure compliance with Next.js 16 async `params`/`searchParams` and route handler conventions.

---

## 2. Makefile & NPM Script Reference

### Makefile Targets (`make help`)

| Target | Command Executed | Purpose |
| :--- | :--- | :--- |
| `make dev` | `pnpm dev` | Launch Next.js 16 development server (`:3000`) |
| `make build` | `pnpm build` | Build production bundle (`next build`) |
| `make start` | `pnpm start` | Start production Node.js server |
| `make verify` | `pnpm verify` | Run all pre-commit gates (`gen:apps` + `tsc` + `eslint` + `check`) |
| `make lint` | `pnpm lint` | Run ESLint across the repository |
| `make typecheck` | `pnpm typecheck` | Run `tsc --noEmit` |
| `make test-e2e` | `node scripts/e2e-simulation.mjs` | Run E2E security, RBAC, and XP simulation suite |
| `make clean` | `rm -rf .next tsconfig.tsbuildinfo` | Clear build and TypeScript incremental caches |
| `make db-up` | `docker compose ... up -d db` | Start local PostgreSQL 16 container (`:5432`) |
| `make db-shell` | `docker exec -it orbit-db psql ...` | Open interactive `psql` shell |
| `make db-backup` | `./infra/scripts/db-backup.sh backups` | Dump SQL snapshot into `./backups/` |
| `make db-reset` | `docker compose down -v && up -d db` | Wipe and recreate a clean PostgreSQL database |
| `make up` | `docker compose up -d` | Launch full Docker stack (PostgreSQL + Orbit App) |
| `make down` | `docker compose down` | Stop all containers gracefully |
| `make logs` | `docker compose logs -f` | Follow container logs in real time |

### NPM / PNPM Scripts (`package.json`)

- `npm run gen:apps`: Scans all 17 `src/apps/*/manifest.ts` files and regenerates `src/apps/registry.gen.ts` and `src/apps/loaders.gen.ts`.
- `npm run check`: Verifies `gen-apps --check`, pure modules & mini-app isolation (`check-pure.mjs`), i18n parity (`check-i18n.mjs`), CSS tokens (`check-tokens.mjs`), and mutation audit coverage (`check-audit-coverage.mjs`).
- `npm run verify`: Full gate required before every commit (`gen:apps` + `tsc --noEmit` + `eslint .` + `npm run check`).
- `npm run build:fim`: Rebuilds the File Integrity Monitoring baseline (`tools/fim/baseline.json`).
- `npm run e2e`: Runs headless Playwright UI test suites (`tests/e2e/ui/run.mjs`).

---

## 3. Embedded Microservice Mini-App Architecture

Orbit Community OS v3.0 structures each of its **17 applications** (16 user-facing mini-apps + 1 internal `mediaviewer`) as a **Self-Contained Embedded Microservice**. Rather than scattering application logic across monolithic global folders, every mini-app encapsulates its own manifest contract, domain types, localization dictionaries, service/repository boundaries, and React client surface:

```text
src/apps/<app-id>/
├── manifest.ts            # Window dimensions, menu bar commands, notification kinds & RBAC definitions
├── types.ts               # Domain TypeScript interfaces and DTO contracts
├── locales/               # Per-app localization bundles (never pollutes the core shell dictionary)
│   ├── en.json
│   └── tr.json
├── index.tsx              # Window root client component
├── components/            # Isolated presentation sub-components
└── hooks/                 # Focused data hooks (useJsonResource)
```

### Strict Isolation Invariants (Enforced at Compile Time by `scripts/check-pure.mjs`)

1. **Zero Cross-App Imports:** Code inside `src/apps/<app-a>/**` must **never** import components, hooks, types, or utilities from `src/apps/<app-b>/**`. All shared primitives live in `src/core/*` or `src/components/Common/*`.
2. **Database Table Ownership:** Each domain repository in `src/db/repositories/<domain>.repo.ts` queries only its own domain tables and read-only core projections (`users`, `units`, `roles`, `files`).
3. **Event-Driven Inter-App Communication (IPC):** Mini-apps communicate asynchronously on the client via `sendAppCommand` / `emitAppEvent` (`@/core/commands`) and on the server via transactional PostgreSQL `LISTEN/NOTIFY` events (`publishEvent` in `src/db/events.ts`). For example, when an attendee checks in to an event (`event_participants.status = 'attended'`), the events service emits a domain event rather than directly mutating the certificates or notifications UI.

---

## 4. Creating a New Mini-App (`src/apps/<id>/`)

You never manually edit the Dock, Mobile Launcher, Spotlight, TopBar menu bar, or RBAC Role Designer—all of them are automatically driven by your mini-app's `manifest.ts`.

### Step-by-Step Mini-App Creation

#### Step 1: Create `src/apps/<id>/manifest.ts`
The folder name `<id>` must match `manifest.id` (lowercase alphanumeric):

```ts
import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'roadmap',
	title: 'Roadmap',
	shortTitle: 'Roadmap',
	description: 'Community product milestones and release tracking',
	category: 'Productivity',
	icon: 'Compass',
	accentColor: '#0a84ff',
	window: { width: 880, height: 580, x: 140, y: 80 },
	component: { module: './index', export: 'RoadmapApp' },
	permission: {
		name: 'Roadmap',
		use: 'View milestones, vote on proposals, and track progress.',
		manage: 'Create, edit, prioritize, and archive roadmap milestones.',
	},
	notifications: {
		roadmap_milestone: 'use',
	},
	menu: {
		about: {
			title: 'About Orbit Roadmap',
			description: 'Milestone planning and community release tracking.',
			version: '3.0',
		},
		categories: [
			{
				label: 'Milestones',
				items: [
					{ id: 'roadmap-new', label: 'New Milestone…', shortcut: '⌘N', command: 'new-milestone', permission: 'manage' },
					{ id: 'roadmap-refresh', label: 'Refresh', shortcut: '⌘R', command: 'refresh' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
```

#### Step 2: Create the Root Component (`src/apps/<id>/index.tsx`)
Use shared kernel hooks from `@/core/*`—never import `@/state/workspaceStore`:

```tsx
'use client';

import React from 'react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { usePermissions } from '@/core/permissions/usePermissions';
import { useAppCommand } from '@/core/commands';
import { useI18n } from '@/core/i18n';

export function RoadmapApp() {
	const { t } = useI18n();
	const { can } = usePermissions();
	const canManage = can('roadmap', 'manage');
	const { data, loading, refresh } = useJsonResource<{ items: Array<{ id: string; title: string }> }>('/api/roadmap');

	useAppCommand('roadmap', (cmd) => {
		if (cmd === 'refresh') refresh();
	});

	if (loading && !data) return <div style={{ padding: 24 }}>{t('common.loading')}</div>;

	return (
		<div style={{ padding: 20 }}>
			{/* Mini-app studio surface (canManage controls administrative actions) */}
		</div>
	);
}
```

#### Step 3: Regenerate the App Registry
```bash
npm run gen:apps
```
This updates `src/apps/registry.gen.ts` and `src/apps/loaders.gen.ts`. Commit both generated files.

#### Step 4: Create the Server API Route (`src/app/api/<id>/route.ts`) & Repository (`src/db/repositories/<id>.repo.ts`)
Always guard the route with `requireApp(request, '<id>', 'use' | 'manage')`:

```ts
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'roadmap', 'use');
	if (!auth.authorized) return auth.response;

	return NextResponse.json({ items: [] });
}
```

---

## 5. Adding a New Language (Zero-Friction 1-PR Localization Guide)

Orbit Community OS v3.0 is engineered so that any open-source contributor can add a brand-new language (e.g., German `de`, Spanish `es`, Japanese `ja`) in a **single Pull Request** **without touching a single SQL table (`ALTER TABLE`), React component (`*.tsx`), or `manifest.ts` file**.

### How Zero-Friction Localization Works

1. **Registry-Driven Locale Discovery (`src/locales/registry.ts`):**
   Supported locales are declared in a single canonical registry:
   ```ts
   export interface LocaleDefinition {
   	code: string;
   	name: string;
   	nativeName: string;
   	dir: 'ltr' | 'rtl';
   }

   export const SUPPORTED_LOCALES = [
   	{ code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
   	{ code: 'tr', name: 'Turkish', nativeName: 'Türkçe', dir: 'ltr' },
   	// Add new locales here (e.g., { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' })
   ] as const satisfies readonly LocaleDefinition[];
   ```
   The `LocaleCode` TypeScript union, TopBar language switcher, Settings → Language selector, and `orbit_locale` persistence automatically derive their options from `SUPPORTED_LOCALES`.

2. **Database `translations JSONB` Columns (Zero Schema Changes):**
   All localizable database entities (`organization_settings.tagline_i18n`, `organization_settings.description_i18n`, `roles.translations`, `form_schemas.translations`, `legal_documents.translations`, and `units.charter_i18n`) store translations inside a dynamic `JSONB` map keyed by locale code:
   ```json
   {
     "en": { "label": "Research Track", "placeholder": "Select your track" },
     "tr": { "label": "Araştırma Alanı", "placeholder": "Alanınızı seçin" },
     "de": { "label": "Forschungsbereich", "placeholder": "Bereich auswählen" }
   }
   ```
   At runtime, `resolveLocalized(translations, activeLocale, 'en')` resolves the user's active locale and falls back gracefully to `'en'` if a dynamic database record has not yet been translated into the new language.

3. **ZeroInline Ternaries & Native `Intl` Formatting:**
   Components never use hardcoded `locale === 'tr' ? ... : ...` checks. All strings use `t('key', { param })`, and all dates/numbers format through native `Intl.DateTimeFormat(locale)` and `Intl.NumberFormat(locale)`.

### 3-Step Checklist to Contribute a New Locale PR

1. **Register the Locale:** Add `{ code: '<lang>', name: '...', nativeName: '...', dir: 'ltr' | 'rtl' }` to `src/locales/registry.ts`.
2. **Add Dictionary Bundles:** Copy `src/locales/en/shell.json` to `src/locales/<lang>/shell.json` and `src/apps/<id>/locales/en.json` to `src/apps/<id>/locales/<lang>.json`, translating all keys.
3. **Run Parity Verification:** Run `npm run verify`. `scripts/check-i18n.mjs` automatically verifies 100% key and placeholder (`{count}`, `{name}`) parity against the canonical English (`en`) dictionary, and `scripts/gen-apps.mjs` compiles localized manifest metadata automatically.

---

## 6. Context Menu Integration (`useContextMenu`)

Orbit provides a unified desktop right-click and mobile long-press context menu system via `useContextMenu` (`src/core/shell/useContextMenu.ts`).

### Key Features of `useContextMenu`
- **Desktop Right-Click (`onContextMenu`):** Intercepts native browser context menus on non-editable elements and renders the Orbit Studio menu at `(clientX, clientY)`.
- **Mobile & Touchscreen Long-Press (`500ms`):** Automatically binds `onTouchStart`, `onTouchMove`, and `onTouchEnd` with a `10px` micro-jitter scroll cancellation threshold and subtle haptic feedback (`navigator.vibrate(20)`).
- **Editable Target Protection:** Automatically ignores `<input>`, `<textarea>`, and `contentEditable` elements so users can always use native copy/paste text selection menus.

### Usage Example in Any Mini-App Row or Card
```tsx
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';

function ProjectRow({ project }: { project: { id: string; title: string; repoUrl: string } }) {
	const contextMenuProps = useContextMenu({
		items: () => [
			{
				id: `open-${project.id}`,
				label: 'Open Project Details',
				action: () => openProject(project.id),
			},
			{
				id: `copy-${project.id}`,
				label: 'Copy Repository URL',
				action: () => copyToClipboard(project.repoUrl),
			},
		],
	});

	return (
		<div {...contextMenuProps} className="project-row">
			{project.title}
		</div>
	);
}
```

---

## 7. Architectural Boundaries & Coding Standards

To keep the codebase modular, fast, and maintainable, enforce these rules across all PRs:

1. **No Cross-App or `workspaceStore` Imports in Mini-Apps:** Components inside `src/apps/**` must import focused hooks from `@/core/session`, `@/core/windows`, `@/core/data`, `@/core/permissions`, `@/core/i18n`, or `@/core/shell`.
2. **No Native `window.alert` / `confirm` / `prompt`:** Always use `useDialog()` (`@/components/Common/DialogProvider`) or `Sheet` (`@/core/ui/Sheet`).
3. **Use Semantic CSS Tokens:** Never hardcode hex background or text colors inside workspace mini-apps. Use semantic CSS custom properties (`var(--window-bg)`, `var(--card-bg)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--border-subtle)`, `var(--accent)`) defined in `src/app/globals.css`.
4. **Domain SQL Belongs in `src/db/repositories/*.repo.ts`:** Write all SQL queries using pure English `snake_case` column identifiers inside `src/db/repositories/<domain>.repo.ts` and re-export them from `src/db/index.ts`. `mapRow()` automatically transforms `snake_case` columns into `camelCase` TypeScript properties.

---

## 8. Verification Gates & E2E Testing (`npm run verify`)

Before opening a pull request or tagging a release, run the complete verification pipeline:

```bash
npm run verify
# (or: make verify)
```

### What `npm run verify` Executes
1. **`node scripts/gen-apps.mjs`**: Ensures `registry.gen.ts` and `loaders.gen.ts` match all 17 `manifest.ts` files.
2. **`tsc --noEmit`**: Strict TypeScript 5.9 type checking across all client, server, and test files.
3. **`eslint .`**: Enforces React 19 hook rules, import boundaries, and security lint rules with zero warnings.
4. **`node scripts/check-pure.mjs`**: Executes fast, dependency-free unit tests against RBAC permissions (`src/core/permissions/index.ts`), notification mappings, theme boot scripts, rate limiters, and cross-app isolation rules.
5. **`node scripts/check-i18n.mjs`**: Verifies 100% key parity across all registered locale dictionaries.
6. **`node scripts/check-tokens.mjs`**: Validates CSS token usage across stylesheets.
7. **`node scripts/check-audit-coverage.mjs`**: Verifies audit trail instrumentation across mutating API routes.

### Running End-to-End API & Browser Suites
```bash
# Run security, RBAC & XP E2E simulation
make test-e2e

# Run headless Playwright browser suites against an isolated test database
npm run e2e
```
