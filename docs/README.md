# Orbit Community OS Documentation

Documentation combines concise human-written guides in `docs/` with auto-generated inventories in `docs/generated/`, `AI_INDEX.json` (`v3.1.0`, `<= 4 KB`), and `.ai/shards/*.json` so schema, route, test, and app surface metadata never drift from code.

---

## Documentation Map

| Document | Scope | Audience |
| :--- | :--- | :--- |
| **[`README.md`](../README.md)** | Project overview, quick start, CLI, and doc links | Everyone |
| **[`AGENTS.md`](../AGENTS.md)** | AI-driven v3.1 workflow, architecture invariants, and gates | AI Agents & Devs |
| **[`docs/ARCHITECTURE.md`](ARCHITECTURE.md)** | App Router monolith, feature domains, PostgreSQL 16 pool, 42 tables, API guards | Architects & Devs |
| **[`docs/OPS_AND_SECURITY.md`](OPS_AND_SECURITY.md)** | Docker profiles, `TRUSTED_PROXY_MODE`, `#token=` setup, device/Passkey auth, Go guard, CLI & tokens | SREs, Security & Contributors |
| **[`src/apps/README.md`](../src/apps/README.md)** | Mini-app manifest & `<id>.contract.json` authoring guide | App Authors |
| **[`tests/e2e/ui/README.md`](../tests/e2e/ui/README.md)** | Playwright browser E2E suites | QA & Developers |
| **[`examples/oauth-client-node/README.md`](../examples/oauth-client-node/README.md)** | OAuth 2.0 + PKCE / OIDC Node.js reference client | Integrators |
| **[`CONTRIBUTING.md`](../CONTRIBUTING.md)** | Contribution checklist, quality gates, PR standards | Contributors |
| **[`SECURITY.md`](../SECURITY.md)** | Vulnerability reporting and deployment security scope | Security & Ops |

---

## Machine-Generated References

Regenerate with `pnpm gen:apps` or `./bin/orbit verify` (`pnpm verify` checks freshness):

| Artifact | Contents | Source of Truth |
| :--- | :--- | :--- |
| **[`AI_INDEX.json`](../AI_INDEX.json)** | Compact v3.1 (`<= 4 KB`) map of modules (`m`), tables (`t`), routes (`r`), and shards (`s`) | `scripts/gen-ai-index.mjs` |
| **[`.ai/shards/*.json`](../.ai/shards)** | **24** domain shards with files, routes, tables, `tests`, `exports`, `limits`, `errorCodes` | `scripts/gen-ai-index.mjs` |
| **[`docs/generated/SCHEMA.md`](generated/SCHEMA.md)** | All **42** PostgreSQL tables, columns, and indexes | `src/db/**` |
| **[`docs/generated/API.md`](generated/API.md)** | All **153** REST/SSE routes, methods, `withAudit`, guards | `src/app/api/**/route.ts` |
| **[`docs/generated/SURFACES.md`](generated/SURFACES.md)** | All **18** app manifests, **27** CLI commands, and active gates | `src/apps/*/manifest.ts`, `scripts/` |

---

## Reading Paths

- **Operator / Security:** [`README.md`](../README.md) -> [`OPS_AND_SECURITY.md`](OPS_AND_SECURITY.md) -> [`generated/API.md`](generated/API.md)
- **Software Engineer / AI Agent:** [`AGENTS.md`](../AGENTS.md) -> [`AI_INDEX.json`](../AI_INDEX.json) -> [`ARCHITECTURE.md`](ARCHITECTURE.md) -> [`generated/SCHEMA.md`](generated/SCHEMA.md)
- **Mini-App Author:** [`src/apps/README.md`](../src/apps/README.md) -> [`AGENTS.md`](../AGENTS.md) -> [`OPS_AND_SECURITY.md`](OPS_AND_SECURITY.md)
