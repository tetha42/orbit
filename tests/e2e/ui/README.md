# Browser E2E Suites (`tests/e2e/ui/`)

Playwright end-to-end tests that exercise the real Next.js application in Chromium — desktop windows, mobile layouts, 2FA/Passkey flows, permissions, SSE updates, and app CRUD journeys. Each file in `tests/e2e/ui/suites/` is automatically discovered as a suite by `tests/e2e/ui/run.mjs`.

---

## 1. Prerequisites

1. **Chromium for Playwright (lean headless shell recommended):**
   ```bash
   pnpm exec playwright-core install chromium-headless-shell
   ```
   *(Headless runs prefer Playwright's lightweight `chromium-headless-shell` when installed to stay under `1 GB` PSS, and fall back automatically to Chrome/Chromium or explicit `E2E_BROWSER_PATH`.)*
2. **Database:**
   - **Self-managed mode (recommended):** Point `E2E_DATABASE_URL` at a throw-away database inside the test PostgreSQL container (`127.0.0.1:55432`, user `test`), e.g. `postgresql://test:test@127.0.0.1:55432/orbit_e2e`. `tests/e2e/ui/lib/db.mjs` explicitly refuses to drop or reset non-test databases (`localhost:5432`, `kulup`, `postgres`, etc.).
   - **External server mode:** Start your own dev server and seed fixtures using `tests/fixtures/dev-fixtures.mjs`, then pass `--base` and `--fixtures`.

---

## 2. Running Suites

### Option A — Runner-Managed Server & Clean Database

```bash
E2E_DATABASE_URL=postgresql://test:test@127.0.0.1:55432/orbit_e2e pnpm e2e
```

The runner drops/recreates the target test database, launches the prebuilt production standalone server (`node .next/standalone/server.js`, ~100 MB RSS with `MOCK_MAIL=true`), runs `tests/fixtures/dev-fixtures.mjs` once to build a snapshot database, shards shared suites across up to 2 workers (`E2E_WORKERS`), and gives `isolated` suites their own fresh empty database + server. A live `/proc` watchdog enforces strict budgets (`<= 1024 MB` total RSS and `<= 180s` runtime by default). Pass `E2E_DEV_SERVER=1` only if you need `next dev`.

### Option B — Against an Already-Running Server

```bash
# 1. Start the server (in another terminal)
MOCK_MAIL=true pnpm dev

# 2. Seed deterministic test roles, users, and sample records
BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... \
  node tests/fixtures/dev-fixtures.mjs --base http://localhost:3000 --out /tmp/orbit-fx.json

# 3. Run selected or all shared suites
pnpm e2e --base http://localhost:3000 --fixtures /tmp/orbit-fx.json
```

*(Isolated suites such as empty-DB onboarding are skipped automatically when `--base` / `E2E_BASE` is provided.)*

### Useful CLI Flags (`tests/e2e/ui/run.mjs`)

| Flag / Env | Description |
| :--- | :--- |
| `--list` | List all available suites, noting `[isolated server]` and `[opt-in by name]` flags |
| `<suite> ...` | Run only named suites (e.g. `pnpm e2e vault inventory`) |
| `--headed` | Show the Chromium browser window instead of running headless |
| `--port` / `E2E_PORT` | Dev server port in self-managed mode (default `3100`) |
| `--base` / `E2E_BASE` | Attach to an already-running server URL |
| `--fixtures` / `E2E_FIXTURES` | Path to JSON fixture output from `tests/fixtures/dev-fixtures.mjs` |
| `E2E_WORKERS` | Worker count (`2` default when running 4+ shared suites in standalone mode; `1` otherwise or with `E2E_DEV_SERVER=1`) |
| `E2E_SHOTS=1` | Capture non-error `t.shot()` PNGs during the run (error shots always saved) |
| `E2E_MAX_RSS_MB` | Total runner + server + Chromium RSS budget in MB (default `1024`) |
| `E2E_MAX_DURATION_SEC` | Total wall-clock runtime budget in seconds (default `180`) |
| `E2E_DEV_SERVER=1` | Fallback to `next dev` instead of `.next/standalone/server.js` |

> Opt-in suites (such as `performance`) are excluded from default `pnpm e2e` runs and execute only when named explicitly (`pnpm e2e performance`).

---

## 3. Authoring a New Suite

Add `tests/e2e/ui/suites/<name>.mjs`. Export `meta` (optional) and a default async function receiving the context object `t` (defined in `tests/e2e/ui/lib/context.mjs`):

```js
export const meta = {
	title: 'Sample feature check',
	// isolated: true, // set if suite requires a fresh empty database
	// optIn: true,    // set if suite should only run when named explicitly
};

export default async function suite(t) {
	const adminApi = t.api('admin');

	await t.step('renders feature inside desktop window', async () => {
		const { page } = await t.open('admin');
		const me = await adminApi.get('/api/auth/me');
		t.eq(me.status, 200, 'admin /api/auth/me returns 200');
		await t.shot(page, 'loaded');
	});
}
```

### Context Helpers & Conventions

- **`t.open(key, opts)` / `t.anonymous(opts)`:** Opens authenticated or anonymous Playwright pages. `tests/e2e/ui/lib/browser.mjs` blocks service workers and seeds `sessionStorage` installed/bypass flags (`orbit_pwa_installed_session_v2`, `orbit_pwa_dev_bypass`, and legacy `beu_pwa_dev_bypass`) so the PWA install prompt does not block UI interactions in production or development builds.
- **`t.api(key)`:** Cookie-backed HTTP client authenticated as a fixture account (`admin`, etc.).
- **`t.check` / `t.eq` / `t.sameSet` / `t.includes` / `t.excludes`:** Non-aborting assertions; wrap sections in `t.step(name, fn)` and register teardown via `t.cleanup(fn)`.
- **Screenshots:** Saved to `tests/e2e/shots/<suite>/` (auto-cleaned per run; git-ignored). Temporary session tokens live in `tests/e2e/.tmp/`.
