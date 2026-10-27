# Orbit Community OS — Developer Onboarding & Engineering Guide

This guide covers everything a software engineer needs to contribute to **Orbit Community OS** by **tetha42**: setting up a local workspace in under five minutes, using `Makefile` targets, building new self-contained mini-applications (`manifest.ts`), integrating desktop & touch context menus (`useContextMenu`), maintaining bilingual localization (`en` primary, `tr` secondary), and passing the compile-time verification gates (`npm run verify`).

---

## Table of Contents

1. [5-Minute Developer Onboarding](#1-5-minute-developer-onboarding)
2. [Makefile & NPM Script Reference](#2-makefile--npm-script-reference)
3. [Creating a New Mini-App (`src/apps/<id>/`)](#3-creating-a-new-mini-app-srcappsid)
4. [Context Menu Integration (`useContextMenu`)](#4-context-menu-integration-usecontextmenu)
5. [Internationalization & Localization (`en` Primary, `tr` Secondary)](#5-internationalization--localization-en-primary-tr-secondary)
6. [Architectural Boundaries & Coding Standards](#6-architectural-boundaries--coding-standards)
7. [Verification Gates & E2E Testing (`npm run verify`)](#7-verification-gates--e2e-testing-npm-run-verify)

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

Open `http://localhost:3000`. If your local PostgreSQL database is empty, the **Web UI Setup Wizard (`/setup`)** opens automatically so you can bind `postgresql://orbit:orbit_secret_2026@localhost:5432/orbit` and create your local administrator account in seconds.

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

- `npm run gen:apps`: Scans `src/apps/*/manifest.ts` and regenerates `src/apps/registry.gen.ts` and `src/apps/loaders.gen.ts`.
- `npm run check`: Verifies `gen-apps --check`, pure modules (`check-pure.mjs`), i18n parity (`check-i18n.mjs`), and CSS tokens (`check-tokens.mjs`).
- `npm run verify`: Full gate required before every commit (`gen:apps` + `tsc --noEmit` + `eslint .` + `npm run check`).
- `npm run build:fim`: Rebuilds the File Integrity Monitoring baseline (`tools/fim/baseline.json`).
- `npm run e2e`: Runs headless Playwright UI test suites (`tests/e2e/ui/run.mjs`).

---

## 3. Creating a New Mini-App (`src/apps/<id>/`)

Every workspace application in Orbit is a self-contained feature directory under `src/apps/<id>/`. You never manually edit the Dock, Mobile Launcher, Spotlight, TopBar menu bar, or RBAC Role Designer—all of them are automatically driven by your mini-app's `manifest.ts`.

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
	en: {
		title: 'Roadmap',
		shortTitle: 'Roadmap',
		description: 'Community product milestones and release tracking',
	},
	category: 'Productivity',
	icon: 'Compass',
	accentColor: '#0a84ff',
	window: { width: 880, height: 580, x: 140, y: 80 },
	component: { module: './index', export: 'RoadmapApp' },
	permission: {
		ad: 'Roadmap',
		kullan: 'View milestones, vote on proposals, and track progress.',
		yonet: 'Create, edit, prioritize, and archive roadmap milestones.',
	},
	notifications: {
		roadmap_milestone: 'kullan',
	},
	menu: {
		about: {
			title: 'About Orbit Roadmap',
			description: 'Milestone planning and community release tracking.',
			version: '2.0',
		},
		categories: [
			{
				label: 'Milestones',
				items: [
					{ id: 'roadmap-new', label: 'New Milestone…', shortcut: '⌘N', komut: 'new-milestone', yetki: 'yonet' },
					{ id: 'roadmap-refresh', label: 'Refresh', shortcut: '⌘R', komut: 'refresh' },
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
import { sendJson } from '@/core/data/http';
import { usePermissions } from '@/core/permissions/usePermissions';
import { useAppCommand } from '@/core/commands';
import { useToast } from '@/core/ui/Toast';
import { useI18n } from '@/core/i18n';

export function RoadmapApp() {
	const { t } = useI18n();
	const { can } = usePermissions();
	const canManage = can('roadmap', 'yonet');
	const { showToast } = useToast();
	const { data, loading, refresh } = useJsonResource<{ items: Array<{ id: string; title: string }> }>('/api/roadmap');

	useAppCommand('roadmap', (cmd) => {
		if (cmd === 'refresh') refresh();
	});

	if (loading && !data) return <div style={{ padding: 24 }}>{t('common.loading')}</div>;

	return (
		<div style={{ padding: 20 }}>
			{/* Mini-app studio surface */}
		</div>
	);
}
```

#### Step 3: Regenerate the App Registry
```bash
npm run gen:apps
```
This updates `src/apps/registry.gen.ts` and `src/apps/loaders.gen.ts`. Commit both generated files.

#### Step 4: Create the Server API Route (`src/app/api/<id>/route.ts`)
Always guard the route with `requireApp(request, '<id>', 'kullan' | 'yonet')`:

```ts
import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'roadmap', 'kullan');
	if (!auth.authorized) return auth.response;

	return NextResponse.json({ items: [] });
}
```

---

## 4. Context Menu Integration (`useContextMenu`)

Orbit provides a unified desktop right-click and mobile long-press context menu system via `useContextMenu` (`src/core/shell/useContextMenu.ts`).

### Key Features of `useContextMenu`
- **Desktop Right-Click (`onContextMenu`):** Intercepts native browser context menus on non-editable elements and renders the Orbit macOS/Studio menu at `(clientX, clientY)`.
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

## 5. Internationalization & Localization (`en` Primary, `tr` Secondary)

Orbit Community OS supports instant, zero-reload language switching via `useI18n()` (`src/core/i18n/`), backed by dictionaries in `src/lib/i18n.ts` and `src/lib/i18nExtra.ts`.

### Localization Rules
1. **Strict Key Parity (`scripts/check-i18n.mjs`):** Every translation key defined in the English (`en`) dictionary **must** also exist in the secondary (`tr`) dictionary, and vice versa. Missing keys fail `npm run verify`.
2. **Manifest Bilingual Metadata:** Every `src/apps/<id>/manifest.ts` must include its English metadata (`en: { title, shortTitle, description }`).
3. **Consuming Translations in Components:**
   ```tsx
   const { t, language, setLanguage } = useI18n();
   return <h1>{t('settings.communityIdentity')}</h1>;
   ```

---

## 6. Architectural Boundaries & Coding Standards

To keep the codebase modular, fast, and maintainable, enforce these rules across all PRs:

1. **No Direct `workspaceStore` Imports in Mini-Apps:** Components inside `src/apps/**` must import focused hooks from `@/core/session`, `@/core/windows`, `@/core/data`, `@/core/permissions`, `@/core/i18n`, or `@/core/shell`.
2. **No Native `window.alert` / `confirm` / `prompt`:** Always use `useDialog()` (`@/components/Common/DialogProvider`) or `Sheet` (`@/core/ui/Sheet`).
3. **Use Semantic CSS Tokens:** Never hardcode hex background or text colors inside workspace mini-apps. Use semantic CSS custom properties (`var(--window-bg)`, `var(--card-bg)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--border-subtle)`, `var(--accent)`) defined in `src/app/globals.css`.
4. **Domain SQL Belongs in Repositories:** Write new SQL queries inside `src/server/db/domains/<domain>.repo.ts` and re-export them from `src/db/index.ts`. Remember to add any new `camelCase` SQL columns to `CAMEL_CASE_COLUMNS` in `src/db/index.ts`.

---

## 7. Verification Gates & E2E Testing (`npm run verify`)

Before opening a pull request or tagging a release, run the complete verification pipeline:

```bash
npm run verify
# (or: make verify)
```

### What `npm run verify` Executes
1. **`node scripts/gen-apps.mjs`**: Ensures `registry.gen.ts` and `loaders.gen.ts` match all 15 `manifest.ts` files.
2. **`tsc --noEmit`**: Strict TypeScript 5.9 type checking across all client, server, and test files.
3. **`eslint .`**: Enforces React 19 hook rules, import boundaries, and security lint rules with zero warnings.
4. **`node scripts/check-pure.mjs`**: Executes fast, dependency-free unit tests against RBAC permissions (`src/core/permissions/index.ts`), notification mappings, theme boot scripts, and rate limiters.
5. **`node scripts/check-i18n.mjs`**: Verifies 100% key parity between `en` and `tr` translation dictionaries.
6. **`node scripts/check-tokens.mjs`**: Validates CSS token usage across stylesheets.

### Running End-to-End API & Browser Suites
```bash
# Run security, RBAC & XP E2E simulation
make test-e2e

# Run headless Playwright browser suites against an isolated test database
npm run e2e
```
