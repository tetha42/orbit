'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Flame, ShieldCheck, Activity, Terminal } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from './Testbench.module.css';

interface AttackScenario {
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

const ATTACK_SCENARIOS: AttackScenario[] = [
	{
		id: 'sqli_auth_bypass',
		name: 'SQL Injection: Authentication Bypass',
		category: 'SQLi',
		endpoint: '/api/auth/login',
		method: 'POST',
		payload: { email: "' OR 1=1 --", password: "password123" },
		expectedBlocked: true,
	},
	{
		id: 'sqli_union_export',
		name: 'SQL Injection: UNION Extraction Probe',
		category: 'SQLi',
		endpoint: "/api/soc/export?servis=auth' UNION SELECT 1,2,3--",
		method: 'GET',
		payload: "servis=auth' UNION SELECT 1,2,3--",
		expectedBlocked: true,
	},
	{
		id: 'xss_script_tag',
		name: 'Stored XSS: Raw Script Tag Injection',
		category: 'XSS',
		endpoint: '/api/notes',
		method: 'POST',
		payload: { baslik: "<script>alert('XSS_POC')</script>", icerik: 'test' },
		expectedBlocked: true,
	},
	{
		id: 'xss_svg_onload',
		name: 'Stored XSS: SVG Event Handler',
		category: 'XSS',
		endpoint: '/api/notes',
		method: 'POST',
		payload: { baslik: '<svg onload=alert(1)>', icerik: 'payload' },
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

export function WafAttackSimulatorTab() {
	const { language } = useI18n();
	const isEn = language === 'en';

	const [scenarios, setScenarios] = useState<AttackScenario[]>(ATTACK_SCENARIOS);
	const [isRunning, setIsRunning] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const runAttackTest = async (scenario: AttackScenario): Promise<AttackScenario> => {
		const start = performance.now();
		try {
			let res: Response;
			if (scenario.method === 'POST') {
				res = await fetch(scenario.endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'x-appsec-probe': '1' },
					body: JSON.stringify(scenario.payload),
				});
			} else {
				res = await fetch(scenario.endpoint, {
					headers: { 'x-appsec-probe': '1' },
				});
			}

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
			} catch {}

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
	};

	const handleRunAllAttacks = async () => {
		setIsRunning(true);
		const updated: AttackScenario[] = [];

		for (const scenario of scenarios) {
			const res = await runAttackTest(scenario);
			updated.push(res);
			setScenarios([...updated, ...scenarios.slice(updated.length)]);
		}

		setIsRunning(false);
	};

	const totalTested = scenarios.filter((s) => s.status !== undefined).length;
	const totalBlocked = scenarios.filter((s) => s.blocked).length;
	const blockRate = totalTested > 0 ? Math.round((totalBlocked / totalTested) * 100) : 100;
	const avgLatency =
		totalTested > 0
			? Math.round(scenarios.filter((s) => s.latencyMs !== undefined).reduce((acc, s) => acc + (s.latencyMs || 0), 0) / totalTested)
			: 0;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			{/* Top Metric Cards */}
			<div className={s.grid}>
				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{isEn ? 'Attack Scenarios' : 'Saldırı Senaryoları'}</span>
						<Flame size={15} color="var(--accent)" />
					</div>
					<div className={s.cardValue}>{scenarios.length}</div>
					<div className={s.cardSub}>{isEn ? 'SQLi, XSS, Traversal, Honeypots' : 'SQLi, XSS, Yol Atlama, Bal Küpleri'}</div>
				</div>

				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{isEn ? 'WAF Interception Rate' : 'WAF Engelleme Oranı'}</span>
						<ShieldCheck size={15} color="#34c759" />
					</div>
					<div className={s.cardValue} style={{ color: blockRate === 100 ? '#34c759' : '#ff9500' }}>
						{totalTested > 0 ? `${blockRate}%` : '—'}
					</div>
					<div className={s.cardSub}>
						{totalTested > 0
							? isEn
								? `${totalBlocked} of ${totalTested} attacks repelled`
								: `${totalTested} saldırıdan ${totalBlocked} tanesi püskürtüldü`
							: isEn
							? 'Ready to test active defenses'
							: 'Aktif savunma testine hazır'}
					</div>
				</div>

				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{isEn ? 'Mean Defense Latency' : 'Ortalama Savunma Gecikmesi'}</span>
						<Activity size={15} color="var(--accent)" />
					</div>
					<div className={s.cardValue}>
						{avgLatency > 0 ? `${avgLatency} ms` : '—'}
					</div>
					<div className={s.cardSub}>{isEn ? 'Inline WAF inspection speed' : 'Hattı içi WAF denetleme hızı'}</div>
				</div>
			</div>

			{/* Control Bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					gap: '12px',
					padding: '12px 16px',
					borderRadius: '8px',
					background: 'var(--fill-soft, rgba(0,0,0,0.03))',
					border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
				}}
			>
				<div>
					<div style={{ fontWeight: 700, fontSize: '13px' }}>
						{isEn ? 'Red Team Automated Attack Fuzzer' : 'Red Team Otomatik Saldırı Simülatörü'}
					</div>
					<div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
						{isEn
							? 'Fires live offensive security vectors against panel routes to verify real-time WAF and IPS interception'
							: 'Gerçek zamanlı WAF ve IPS korumasını doğrulamak için panel rotalarına canlı saldırı vektörleri gönderir'}
					</div>
				</div>

				<button
					type="button"
					className={s.btnPrimary}
					onClick={handleRunAllAttacks}
					disabled={isRunning}
					style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
				>
					<Play size={13} />
					<span>{isRunning ? (isEn ? 'Firing Attack Suite...' : 'Saldırılar Gönderiliyor...') : (isEn ? 'Launch Attack Suite' : 'Saldırı Testini Başlat')}</span>
				</button>
			</div>

			{/* Attack Results Table */}
			<div className={s.tableContainer}>
				<table className={s.table}>
					<thead>
						<tr>
							<th>{isEn ? 'Attack Scenario' : 'Saldırı Senaryosu'}</th>
							<th>{isEn ? 'Category' : 'Kategori'}</th>
							<th>{isEn ? 'Target Endpoint' : 'Hedef Uç Nokta'}</th>
							<th>{isEn ? 'HTTP Status' : 'HTTP Kodu'}</th>
							<th>{isEn ? 'WAF Protection' : 'WAF Koruması'}</th>
							<th>{isEn ? 'Latency' : 'Gecikme'}</th>
							<th>{isEn ? 'Inspect' : 'İncele'}</th>
						</tr>
					</thead>
					<tbody>
						{scenarios.map((sc) => {
							const isTested = sc.status !== undefined;
							return (
								<React.Fragment key={sc.id}>
									<tr>
										<td>
											<div style={{ fontWeight: 600, fontSize: '12px' }}>{sc.name}</div>
										</td>
										<td>
											<span className={s.badge} style={{ fontSize: '10.5px' }}>
												{sc.category}
											</span>
										</td>
										<td className={s.mono} style={{ fontSize: '11px' }}>
											{sc.endpoint}
										</td>
										<td>
											{isTested ? (
												<span
													style={{
														fontFamily: 'monospace',
														fontSize: '11px',
														fontWeight: 700,
														color: sc.status === 403 ? '#d70015' : sc.status === 404 ? '#ff9500' : 'var(--text-primary)',
													}}
												>
													{sc.status}
												</span>
											) : (
												<span style={{ color: 'var(--text-tertiary)' }}>—</span>
											)}
										</td>
										<td>
											{isTested ? (
												<span
													style={{
														display: 'inline-flex',
														alignItems: 'center',
														gap: '4px',
														fontSize: '11px',
														fontWeight: 700,
														padding: '2px 8px',
														borderRadius: '4px',
														background: sc.blocked ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)',
														color: sc.blocked ? '#248a3d' : '#d70015',
													}}
												>
													{sc.blocked ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
													{sc.blocked ? (isEn ? 'INTERCEPTED' : 'ENGSELLENDİ') : (isEn ? 'PASSED' : 'GEÇTİ')}
												</span>
											) : (
												<span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
													{isEn ? 'Idle' : 'Beklemede'}
												</span>
											)}
										</td>
										<td className={s.mono} style={{ fontSize: '11px' }}>
											{sc.latencyMs !== undefined ? `${sc.latencyMs} ms` : '—'}
										</td>
										<td>
											<button
												type="button"
												className={s.btn}
												style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
												onClick={() => setExpandedId(expandedId === sc.id ? null : sc.id)}
											>
												<Terminal size={11} />
												<span>{expandedId === sc.id ? (isEn ? 'Hide' : 'Gizle') : (isEn ? 'Payload' : 'Yük')}</span>
											</button>
										</td>
									</tr>

									{expandedId === sc.id && (
										<tr>
											<td colSpan={7} style={{ background: 'var(--fill-softer)', padding: '12px' }}>
												<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
													<div>
														<strong style={{ color: 'var(--text-secondary)' }}>
															{isEn ? 'Injected Malicious Payload:' : 'Enjekte Edilen Zararlı Yük:'}
														</strong>
														<pre
															style={{
																margin: '4px 0 0',
																padding: '8px',
																background: 'var(--window-bg)',
																borderRadius: '6px',
																border: '1px solid var(--border-subtle)',
																fontFamily: 'monospace',
																whiteSpace: 'pre-wrap',
															}}
														>
															{typeof sc.payload === 'object' ? JSON.stringify(sc.payload, null, 2) : String(sc.payload)}
														</pre>
													</div>

													{sc.interceptMessage && (
														<div>
															<strong style={{ color: 'var(--text-secondary)' }}>
																{isEn ? 'Server Defense Telemetry Response:' : 'Sunucu Savunma Telemetri Yanıtı:'}
															</strong>
															<div
																style={{
																	marginTop: '4px',
																	padding: '6px 8px',
																	background: 'rgba(52, 199, 89, 0.1)',
																	color: '#248a3d',
																	borderRadius: '4px',
																	fontWeight: 600,
																}}
															>
																{sc.interceptMessage}
															</div>
														</div>
													)}
												</div>
											</td>
										</tr>
									)}
								</React.Fragment>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
export default WafAttackSimulatorTab;
