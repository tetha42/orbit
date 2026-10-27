import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOAuthClient, getOAuthClients } from '../../src/db/oauth.ts';
import { getKullanicilar } from '../../src/server/db/domains/members.repo.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

async function setup() {
	console.log('\n🚀 [Demo App] Starting OAuth 2.0 Client Setup...');

	const users = await getKullanicilar();
	const adminUser = users.find((u) => u.eposta === 'admin@orbit.local') || users[0];

	if (!adminUser) {
		console.error('❌ No users found in the database.');
		process.exit(1);
	}

	const redirectUri = 'http://localhost:4000/callback';

	// Check existing clients
	const clients = await getOAuthClients();
	const existing = clients.find((c) => c.ad === 'Orbit Demo Client' || c.ad === 'Demo Web Portalı');

	if (existing && existing.redirectUris.includes(redirectUri)) {
		console.log(`ℹ️ OAuth client '${existing.ad}' already exists in the database (ID: ${existing.id}).`);

		try {
			const existingConfig = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
			if (existingConfig.clientId === existing.id && existingConfig.clientSecret) {
				console.log('✅ Existing config.json is valid and ready.');
				return;
			}
		} catch {
			// Recreate if config.json is missing or invalid
		}
	}

	console.log('📦 Registering new OAuth demo client...');
	const { client, plainSecret } = await createOAuthClient(
		{
			ad: 'Orbit Demo Client',
			aciklama: 'Orbit Community OS OAuth 2.0 & OIDC Reference Client Application',
			redirectUris: [redirectUri],
			guvenilir: false,
		},
		adminUser.id
	);

	const configData = {
		port: 4000,
		issuer: 'http://localhost:3000',
		clientId: client.id,
		clientSecret: plainSecret,
		redirectUri,
		scopes: 'openid profile email academic roles',
	};

	await fs.writeFile(CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf8');

	console.log('\n✨ Demo OAuth Client Created Successfully!');
	console.log('----------------------------------------------------');
	console.log(`• Client ID     : ${client.id}`);
	console.log(`• Client Secret : ${plainSecret}`);
	console.log(`• Redirect URI  : ${redirectUri}`);
	console.log(`• Config File   : ${CONFIG_PATH}`);
	console.log('----------------------------------------------------');
	console.log("👉 Run 'node server.mjs' and visit http://localhost:4000!\n");
}

setup().catch((err) => {
	console.error('Setup error:', err);
	process.exit(1);
});
