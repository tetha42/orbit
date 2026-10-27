# 🔐 Orbit Community OS — OAuth 2.0 & OIDC Reference Client (Node.js)

This reference application demonstrates how external web services, community portals, and engineering teams integrate with **Orbit Community OS** as an **OAuth 2.0 & OpenID Connect (OIDC)** Single Sign-On Identity Provider (SSO IdP).

Runs with zero external dependencies using native Node.js modules (`http`, `crypto`, `fetch`).

---

## 🚀 Quick Start

### 1. Client Registration
Automatically register the demo application in your Orbit database and generate `config.json`:

```bash
cd examples/oauth-client-node
pnpm setup
# or: npx tsx setup.mjs
```

This command:
* Registers an OAuth client named `Orbit Demo Client`.
* Authorizes the callback URI (`http://localhost:4000/callback`).
* Writes `client_id` and `client_secret` to `config.json`.

*(Note: You can also create client credentials manually in **Settings > Integrated Apps (OAuth)** inside Orbit OS and place them in `config.json`.)*

---

### 2. Start the Demo Server

```bash
cd examples/oauth-client-node
node server.mjs
# or: pnpm start
```

The server listens at `http://localhost:4000`.

---

### 3. Test the OAuth Flow

1. Open **`http://localhost:4000`** in your browser.
2. Click **"Sign in with Orbit Community OS"**.
3. You are redirected to `http://localhost:3000/oauth/authorize`:
   * If you are not signed in to Orbit, you will be prompted to sign in first.
   * Unless the client is marked as "Trusted", the **Authorization Consent** screen is displayed with requested scopes (`profile`, `email`, `academic`, `roles`).
4. Once approved, the browser redirects back to `http://localhost:4000/callback` with a single-use authorization code.
5. The demo server exchanges the code + PKCE `code_verifier` for an `access_token` and OIDC `id_token` (`POST /api/oauth/token`), queries `GET /api/oauth/userinfo`, and opens your authenticated profile dashboard.

---

## 🛠️ Architecture & Security Details

* **Protocol:** OAuth 2.0 Authorization Code Grant + RFC 7636 PKCE (`code_challenge_method=S256`).
* **OpenID Connect (OIDC):** HS256-signed standard `id_token` (`sub`, `name`, `email`, `role`, `student_no`).
* **UserInfo API:** Bearer-token-protected profile and role claim endpoint.
* **Trusted Application Mode:** Mark the client as *"Trusted"* in **Settings > Integrated Apps (OAuth)** to enable instant one-click SSO without the consent prompt.
