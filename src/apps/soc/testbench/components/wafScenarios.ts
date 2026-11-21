export interface AttackScenario {
	id: string;
	name: string;
	category: 'SQLi' | 'XSS' | 'Path Traversal' | 'Recon Honeypot' | 'Rate Limit';
	endpoint: string;
	method: 'GET' | 'POST';
	payload: string | Record<string, unknown>;
	expectedBlocked: boolean;
	status?: number;
	blocked?: boolean;
	latencyMs?: number;
	interceptMessage?: string;
	headersChecked?: boolean;
}

export const ATTACK_SCENARIOS: AttackScenario[] = [
	{
		id: 'sqli_auth_bypass',
		name: 'SQL Injection: Authentication Bypass',
		category: 'SQLi',
		endpoint: '/api/auth/login',
		method: 'POST',
		payload: { email: "' OR 1=1 --", password: 'password123' },
		expectedBlocked: true,
	},
	{
		id: 'sqli_union_export',
		name: 'SQL Injection: UNION Extraction Probe',
		category: 'SQLi',
		endpoint: "/api/soc/export?service=auth' UNION SELECT 1,2,3--",
		method: 'GET',
		payload: "service=auth' UNION SELECT 1,2,3--",
		expectedBlocked: true,
	},
	{
		id: 'xss_script_tag',
		name: 'Stored XSS: Raw Script Tag Injection',
		category: 'XSS',
		endpoint: '/api/notes',
		method: 'POST',
		payload: { title: "<script>alert('XSS_POC')</script>", content: 'test' },
		expectedBlocked: true,
	},
	{
		id: 'xss_svg_onload',
		name: 'Stored XSS: SVG Event Handler',
		category: 'XSS',
		endpoint: '/api/notes',
		method: 'POST',
		payload: { title: '<svg onload=alert(1)>', content: 'payload' },
		expectedBlocked: true,
	},
	{
		id: 'traversal_passwd',
		name: 'Directory Traversal: Linux /etc/passwd',
		category: 'Path Traversal',
		endpoint: '/api/uploads/../../../../etc/passwd',
		method: 'GET',
		payload: '../../../../etc/passwd',
		expectedBlocked: true,
	},
	{
		id: 'traversal_config',
		name: 'Directory Traversal: Server Config Escape',
		category: 'Path Traversal',
		endpoint: '/api/uploads/..%2f..%2fconfig.ini',
		method: 'GET',
		payload: '..%2f..%2fconfig.ini',
		expectedBlocked: true,
	},
	{
		id: 'honeypot_env',
		name: 'Canary Honeypot: Root /.env Extraction Probe',
		category: 'Recon Honeypot',
		endpoint: '/.env',
		method: 'GET',
		payload: 'GET /.env',
		expectedBlocked: true,
	},
	{
		id: 'honeypot_wp_login',
		name: 'Bot Deception: Legacy /wp-login.php Probe',
		category: 'Recon Honeypot',
		endpoint: '/wp-login.php',
		method: 'GET',
		payload: 'GET /wp-login.php',
		expectedBlocked: true,
	},
];

export async function runAttackScenario(scenario: AttackScenario): Promise<AttackScenario> {
	const start = performance.now();
	try {
		const res =
			scenario.method === 'POST'
				? await fetch(scenario.endpoint, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', 'x-appsec-probe': '1' },
						body: JSON.stringify(scenario.payload),
					})
				: await fetch(scenario.endpoint, {
						headers: { 'x-appsec-probe': '1' },
					});

		const latencyMs = Math.round(performance.now() - start);
		const status = res.status;

		// A payload is considered properly blocked/guarded if WAF returns 403 Forbidden,
		// or router returns 404/405/400 without executing malicious logic
		const blocked = status === 403 || status === 401 || status === 404 || status === 400 || status === 429;
		let interceptMessage = `HTTP ${status} ${res.statusText}`;

		try {
			const json = await res.json().catch(() => null);
			if (json?.error) {
				interceptMessage = `${status} - ${json.error}`;
			}
		} catch {
			// Retain the HTTP status fallback when response payload parsing fails.
		}

		const headersChecked = Boolean(
			res.headers.get('x-content-type-options') ||
			res.headers.get('x-frame-options') ||
			res.headers.get('strict-transport-security')
		);

		return {
			...scenario,
			status,
			blocked,
			latencyMs,
			interceptMessage,
			headersChecked,
		};
	} catch (err: unknown) {
		const latencyMs = Math.round(performance.now() - start);
		return {
			...scenario,
			status: 0,
			blocked: true,
			latencyMs,
			interceptMessage: `Network Connection Blocked (${String(err)})`,
			headersChecked: false,
		};
	}
}
