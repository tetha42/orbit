import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

// In-memory session store & pending authorization requests
const sessions = new Map();
const pendingAuth = new Map();

async function loadConfig() {
	try {
		const raw = await fs.readFile(CONFIG_PATH, 'utf8');
		return JSON.parse(raw);
	} catch {
		console.error('⚠️  config.json not found. Please run "node setup.mjs" first.');
		return {
			port: 4000,
			issuer: 'http://localhost:3000',
			clientId: '',
			clientSecret: '',
			redirectUri: 'http://localhost:4000/callback',
			scopes: 'openid profile email academic roles',
		};
	}
}

function parseCookies(req) {
	const list = {};
	const rc = req.headers.cookie;
	if (!rc) return list;
	rc.split(';').forEach((cookie) => {
		const parts = cookie.split('=');
		const key = parts.shift().trim();
		const val = decodeURIComponent(parts.join('='));
		list[key] = val;
	});
	return list;
}

function decodeJwtPayload(jwtStr) {
	try {
		const parts = jwtStr.split('.');
		if (parts.length !== 3) return null;
		let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		while (base64.length % 4) base64 += '=';
		return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
	} catch {
		return null;
	}
}

function renderHtml(title, body) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Orbit OAuth Demo</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #111113;
      --border: #27272a;
      --accent: #fafafa;
      --text: #fafafa;
      --text-muted: #a1a1aa;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --code-bg: #09090b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .container {
      width: 100%;
      max-width: 860px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: #18181b;
      color: #e4e4e7;
      border: 1px solid var(--border);
    }
    .badge.green {
      background: rgba(16, 185, 129, 0.12);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.3);
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: #fafafa;
      color: #09090b;
    }
    .btn-primary:hover {
      background: #e4e4e7;
    }
    .btn-outline {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-outline:hover {
      background: #18181b;
    }
    .btn-danger {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 12.5px;
      color: #e4e4e7;
      overflow-x: auto;
      max-height: 280px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .stat-box {
      background: #09090b;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-val { font-size: 16px; font-weight: 600; margin-top: 4px; }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      background: #18181b;
      border: 1px solid var(--border);
      margin: 2px;
      font-family: monospace;
    }
    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #18181b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      color: #fafafa;
      border: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
	try {
		const config = await loadConfig();
		const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:4000'}`);
		const pathname = parsedUrl.pathname;
		const cookies = parseCookies(req);

		// 1. Landing Page (Home)
		if (pathname === '/') {
			const sessionId = cookies.demo_session;
			const session = sessionId ? sessions.get(sessionId) : null;

			if (!session) {
				const body = `
        <div class="header">
          <div>
            <h1 style="font-size: 24px; font-weight: 800;">Orbit OAuth Demo Client</h1>
            <p style="font-size: 14px; color: var(--text-muted); margin-top: 4px;">OAuth 2.0 & OpenID Connect Integration Sandbox</p>
          </div>
          <span class="badge">Port 4000</span>
        </div>

        <div class="card" style="text-align: center; padding: 48px 24px;">
          <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 10px;">Sign in with Single Sign-On</h2>
          <p style="color: var(--text-muted); max-width: 540px; margin: 0 auto 28px auto; font-size: 14.5px; line-height: 1.6;">
            This reference application acts as an external relying party using 
            <strong>OAuth 2.0 Authorization Code Flow + PKCE (S256)</strong>.
          </p>
          <a href="/login" class="btn btn-primary" style="font-size: 16px; padding: 14px 32px;">
            Sign in with Orbit Community OS
          </a>
        </div>

        <div class="card">
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 14px;">Active OIDC Client Configuration</h3>
          <div class="grid">
            <div class="stat-box">
              <div class="stat-label">Identity Provider (Issuer)</div>
              <div class="stat-val" style="font-size: 14px;">${config.issuer}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Client ID</div>
              <div class="stat-val" style="font-size: 13px; font-family: monospace;">${config.clientId || 'NONE (run node setup.mjs)'}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Redirect URI</div>
              <div class="stat-val" style="font-size: 13px; font-family: monospace;">${config.redirectUri}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Requested Scopes</div>
              <div class="stat-val" style="font-size: 13px;">${config.scopes}</div>
            </div>
          </div>
        </div>
      `;
				res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(renderHtml('Sign In', body));
				return;
			}

			// Authenticated View (User Dashboard)
			const user = session.user;
			const tokens = session.tokens;
			const decodedId = decodeJwtPayload(tokens.id_token);

			const initials = user.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U';

			const body = `
      <div class="header">
        <div>
          <h1 style="font-size: 24px; font-weight: 800;">Welcome, ${user.name}!</h1>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Authenticated via Orbit Community OS Single Sign-On</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <a href="/logout" class="btn btn-danger" style="padding: 8px 16px; font-size: 13px;">Sign Out</a>
        </div>
      </div>

      <!-- User Profile Card -->
      <div class="card" style="display: flex; gap: 24px; align-items: center;">
        <div class="avatar">${initials}</div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-size: 20px; font-weight: 700;">${user.name}</h2>
            <span class="badge green">Verified</span>
            ${user.role ? `<span class="badge">${user.role.name || 'Member'}</span>` : ''}
          </div>
          <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">${user.email}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: var(--text-muted);">Member ID / Handle</div>
          <div style="font-size: 15px; font-weight: 600; font-family: monospace;">${user.student_no || 'Not set'}</div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="grid">
        <div class="stat-box">
          <div class="stat-label">Track / Level</div>
          <div class="stat-val">${user.department || '—'} / ${user.grade || '—'}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Earned XP</div>
          <div class="stat-val">${user.xp ?? 0} XP</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Administrator</div>
          <div class="stat-val">${user.role?.is_admin ? 'Yes (Admin)' : 'No'}</div>
        </div>
      </div>

      <!-- Permissions -->
      <div class="card">
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">Permissions Claim</h3>
        <div>
          ${(Array.isArray(user.permissions)
            ? user.permissions
            : typeof user.permissions === 'object' && user.permissions !== null
              ? Object.entries(user.permissions).map(([k, v]) => `${k}: ${v}`)
              : []
          ).map((p) => `<span class="pill">${p}</span>`).join('') || '<span style="color: var(--text-muted); font-size: 13px;">No custom permissions defined.</span>'}
        </div>
      </div>

      <!-- Live Token Inspector -->
      <div class="card">
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">OIDC ID Token Claims (Decoded JWT)</h3>
        <pre>${JSON.stringify(decodedId, null, 2)}</pre>
      </div>

      <div class="card">
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">UserInfo Endpoint Response</h3>
        <pre>${JSON.stringify(user, null, 2)}</pre>
      </div>

      <div class="card">
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">OAuth 2.0 / OIDC Protocol Trace</h3>
        <pre>${JSON.stringify(session.trace || { pkce: 'S256', grantType: 'authorization_code' }, null, 2)}</pre>
      </div>
    `;

			res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
			res.end(renderHtml('Profile', body));
			return;
		}

		// 2. Start OAuth Flow
		if (pathname === '/login') {
			if (!config.clientId || !config.clientSecret) {
				res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
				res.end('Error: clientId or clientSecret missing in config.json. Please run "node setup.mjs" first.');
				return;
			}

			const codeVerifier = crypto.randomBytes(32).toString('base64url');
			const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
			const state = crypto.randomBytes(16).toString('hex');

			pendingAuth.set(state, {
				codeVerifier,
				createdAt: Date.now(),
			});

			const authUrl = new URL(`${config.issuer}/oauth/authorize`);
			authUrl.searchParams.set('response_type', 'code');
			authUrl.searchParams.set('client_id', config.clientId);
			authUrl.searchParams.set('redirect_uri', config.redirectUri);
			authUrl.searchParams.set('scope', config.scopes);
			authUrl.searchParams.set('state', state);
			authUrl.searchParams.set('code_challenge', codeChallenge);
			authUrl.searchParams.set('code_challenge_method', 'S256');

			res.writeHead(302, {
				Location: authUrl.toString(),
				'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax`,
			});
			res.end();
			return;
		}

		// 3. OAuth Callback
		if (pathname === '/callback') {
			const code = parsedUrl.searchParams.get('code');
			const state = parsedUrl.searchParams.get('state');
			const error = parsedUrl.searchParams.get('error');
			const errorDesc = parsedUrl.searchParams.get('error_description');

			if (error) {
				const body = `
        <div class="card" style="border-color: rgba(239, 68, 68, 0.4); text-align: center; padding: 40px;">
          <h2 style="color: #f87171; font-size: 20px; font-weight: 700;">Authorization Failed</h2>
          <p style="color: var(--text-muted); margin: 12px 0 24px 0;">${errorDesc || error}</p>
          <a href="/" class="btn btn-outline">Back to Home</a>
        </div>
      `;
				res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(renderHtml('Error', body));
				return;
			}

			const pending = state ? pendingAuth.get(state) : null;
			if (!pending) {
				res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(renderHtml('Invalid State', '<div class="card"><p>Invalid or expired OAuth state parameter. Please try again.</p><br><a href="/" class="btn btn-primary">Home</a></div>'));
				return;
			}

			pendingAuth.delete(state);

			try {
				console.log(`🔄 [Demo App] Exchanging authorization code for tokens: ${code.slice(0, 10)}...`);
				const tokenRes = await fetch(`${config.issuer}/api/oauth/token`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: new URLSearchParams({
						grant_type: 'authorization_code',
						client_id: config.clientId,
						client_secret: config.clientSecret,
						code,
						redirect_uri: config.redirectUri,
						code_verifier: pending.codeVerifier,
					}).toString(),
				});

				const tokenData = await tokenRes.json();
				if (!tokenRes.ok) {
					throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed.');
				}

				console.log('👤 [Demo App] Fetching user profile (UserInfo API)...');
				const userinfoRes = await fetch(`${config.issuer}/api/oauth/userinfo`, {
					headers: {
						Authorization: `Bearer ${tokenData.access_token}`,
					},
				});

				const userData = await userinfoRes.json();
				if (!userinfoRes.ok) {
					throw new Error(userData.error_description || userData.error || 'Failed to fetch user profile.');
				}

				const sessionId = crypto.randomUUID();
				sessions.set(sessionId, {
					user: userData,
					tokens: tokenData,
					trace: {
						completedAt: new Date().toISOString(),
						protocol: 'OAuth 2.0 + OpenID Connect (OIDC)',
						grantType: 'authorization_code',
						pkce: {
							method: 'S256',
							verified: true,
						},
						tokenType: tokenData.token_type,
						expiresInSeconds: tokenData.expires_in,
						scope: tokenData.scope,
						endpointsUsed: {
							tokenEndpoint: `${config.issuer}/api/oauth/token`,
							userinfoEndpoint: `${config.issuer}/api/oauth/userinfo`,
						},
					},
					createdAt: Date.now(),
				});

				console.log(`✅ [Demo App] Login succeeded: ${userData.name} (${userData.email})`);

				res.writeHead(302, {
					Location: '/',
					'Set-Cookie': `demo_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
				});
				res.end();
				return;
			} catch (err) {
				console.error('Callback error:', err);
				const body = `
        <div class="card" style="border-color: rgba(239, 68, 68, 0.4); text-align: center; padding: 40px;">
          <h2 style="color: #f87171; font-size: 20px; font-weight: 700;">Sign-In Failed</h2>
          <p style="color: var(--text-muted); margin: 12px 0 24px 0;">${err.message || 'An unexpected error occurred.'}</p>
          <a href="/" class="btn btn-outline">Try Again</a>
        </div>
      `;
				res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(renderHtml('Error', body));
				return;
			}
		}

		// 4. Logout
		if (pathname === '/logout') {
			const sessionId = cookies.demo_session;
			if (sessionId) {
				sessions.delete(sessionId);
			}
			res.writeHead(302, {
				Location: '/',
				'Set-Cookie': 'demo_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
			});
			res.end();
			return;
		}

		res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end('Not Found');
	} catch (err) {
		console.error('Server request error:', err);
		if (!res.headersSent) {
			res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
			res.end('Internal Server Error: ' + (err.message || 'Unknown error'));
		}
	}
});

const PORT = 4000;
server.listen(PORT, () => {
	console.log(`\n======================================================`);
	console.log(`🎉 Orbit OAuth Reference Client Running!`);
	console.log(`🌐 URL: http://localhost:${PORT}`);
	console.log(`🔗 Identity Provider: http://localhost:3000`);
	console.log(`======================================================\n`);
});
