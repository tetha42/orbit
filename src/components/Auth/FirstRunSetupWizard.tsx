'use client';

import React, { useState, useEffect } from 'react';
import {
	Database,
	Building2,
	User,
	Mail,
	Lock,
	ArrowRight,
	ArrowLeft,
	CheckCircle2,
	AlertCircle,
	Sparkles,
	RefreshCw,
	Server,
	Globe,
	Check,
	Copy,
	Download,
	Terminal,
	Cpu,
} from 'lucide-react';
import styles from './VsCodeSetup.module.css';
import { DEFAULT_TEAM_CATEGORIES } from '@/lib/teamCategories';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/registrationConfig';

interface FirstRunSetupWizardProps {
	onComplete: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface DetectedCandidate {
	url: string;
	label: string;
	host: string;
	dbName: string;
	type: string;
}

interface StepMeta {
	number: WizardStep;
	navTitle: string;
	navSubtitle: string;
	title: string;
	description: string;
	nextLabel: string;
}

const STEP_METAS: Record<WizardStep, StepMeta> = {
	1: {
		number: 1,
		navTitle: 'Database Engine',
		navSubtitle: 'PostgreSQL instance & auto-detect',
		title: 'Configure Database Engine',
		description:
			'Orbit Community OS requires a PostgreSQL instance. Connect to a local container, Docker Compose network, or baremetal host. Zero external config files are required.',
		nextLabel: 'Next: Workspace Identity',
	},
	2: {
		number: 2,
		navTitle: 'Workspace Identity',
		navSubtitle: 'Studio, community & domain routing',
		title: 'Customize Workspace & Domain Identity',
		description:
			'Define your studio entity, community workspace name, and public domain for reverse proxy routing. Settings are persisted directly to system_settings.',
		nextLabel: 'Next: Root Administrator',
	},
	3: {
		number: 3,
		navTitle: 'Root Administrator',
		navSubtitle: 'Initial superuser account credentials',
		title: 'Create Root Administrator Account',
		description:
			'Set up the primary superuser account to manage community members, role permissions, and autonomous cybersecurity defense policies.',
		nextLabel: 'Next: Outbound Mail (SMTP)',
	},
	4: {
		number: 4,
		navTitle: 'Outbound Mail (SMTP)',
		navSubtitle: 'Email relay & notification alerts',
		title: 'Configure Outbound Mail Services',
		description:
			'Set up an optional SMTP relay for automated verification emails, notifications, and password resets. You can skip this step and configure it later.',
		nextLabel: 'Next: Review & Launch',
	},
	5: {
		number: 5,
		navTitle: 'Review & Launch',
		navSubtitle: 'Verify parameters & bootstrap workspace',
		title: 'Review & Initialize Workspace',
		description:
			'All installation parameters are validated. Initializing will provision the PostgreSQL database schema and launch Orbit Community OS.',
		nextLabel: 'Initialize & Launch Orbit OS',
	},
};

export function FirstRunSetupWizard({ onComplete }: FirstRunSetupWizardProps) {
	const [currentStep, setCurrentStep] = useState<WizardStep>(1);
	const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
	const [loading, setLoading] = useState(false);
	const [testingDb, setTestingDb] = useState(false);
	const [dbTestResult, setDbTestResult] = useState<{ ok: boolean; message: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [launching, setLaunching] = useState(false);

	// Step 1: Database & Auto-Detection
	const [dbUrl, setDbUrl] = useState('');
	const [dbConnected, setDbConnected] = useState(false);
	const [dbName, setDbName] = useState('');
	const [scanningDb, setScanningDb] = useState(false);
	const [detectedCandidates, setDetectedCandidates] = useState<DetectedCandidate[]>([]);
	const [showDockerSnippet, setShowDockerSnippet] = useState(false);
	const [copiedDocker, setCopiedDocker] = useState(false);

	// Step 2: Identity & Reverse Proxy Assistant
	const [studioName, setStudioName] = useState('tetha42');
	const [communityName, setCommunityName] = useState('Orbit Community');
	const [domain, setDomain] = useState('orbit.local');
	const [showProxyConfig, setShowProxyConfig] = useState(false);
	const [proxyType, setProxyType] = useState<'nginx' | 'caddy'>('nginx');
	const [copiedProxy, setCopiedProxy] = useState(false);

	// Step 3: Admin Credentials
	const [ad, setAd] = useState('Orbit');
	const [soyad, setSoyad] = useState('Admin');
	const [email, setEmail] = useState('admin@orbit.local');
	const [password, setPassword] = useState('');
	const [passwordConfirm, setPasswordConfirm] = useState('');

	// Step 4: SMTP (Optional)
	const [smtpHost, setSmtpHost] = useState('');
	const [smtpPort, setSmtpPort] = useState('465');
	const [smtpUser, setSmtpUser] = useState('');
	const [smtpPassword, setSmtpPassword] = useState('');
	const [smtpFrom, setSmtpFrom] = useState('');

	// Auto-scan databases
	const scanDatabases = async () => {
		setScanningDb(true);
		try {
			const res = await fetch('/api/setup/auto-detect', { cache: 'no-store' });
			const data = await res.json().catch(() => ({}));
			if (res.ok && Array.isArray(data?.candidates)) {
				setDetectedCandidates(data.candidates);
				if (data.candidates.length > 0) {
					const first = data.candidates[0] as DetectedCandidate;
					setDbUrl((prev) => prev || first.url);
					setDbConnected(true);
					if (first.dbName) setDbName((prev) => prev || first.dbName);
					setCompletedSteps((prev) => new Set(prev).add(1));
				}
			}
		} catch {
			// Ignore auto-probe failure
		} finally {
			setScanningDb(false);
		}
	};

	// Initial probe
	useEffect(() => {
		fetch('/api/setup', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.hazir === true) {
					if (typeof window !== 'undefined') {
						// eslint-disable-next-line @next/next/no-location-assign-relative-destination
						window.location.href = '/';
					} else {
						onComplete();
					}
					return;
				}
				if (data?.dbStatus?.connected) {
					setDbConnected(true);
					if (data.dbStatus.databaseName) setDbName(data.dbStatus.databaseName);
					setCompletedSteps((prev) => new Set(prev).add(1));
				}
				if (data?.brand) {
					if (data.brand.studioName) setStudioName(data.brand.studioName);
					if (data.brand.communityName) setCommunityName(data.brand.communityName);
					if (data.brand.domain) setDomain(data.brand.domain);
				}
			})
			.catch(() => {});

		void scanDatabases();
	}, [onComplete]);

	const handleSelectCandidate = async (candidateUrl: string) => {
		setDbUrl(candidateUrl);
		setError(null);
		setDbTestResult(null);
		setTestingDb(true);
		try {
			const res = await fetch('/api/setup/test-db', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: candidateUrl }),
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.ok) {
				if (data.databaseName) setDbName(data.databaseName);
				setDbTestResult({
					ok: true,
					message: data.message || 'Detected database connected and verified!',
				});
				setDbConnected(true);
				setCompletedSteps((prev) => new Set(prev).add(1));
				if (data.alreadyInitialized) {
					setTimeout(() => {
						if (typeof window !== 'undefined') {
							// eslint-disable-next-line @next/next/no-location-assign-relative-destination
							window.location.href = '/';
						} else {
							onComplete();
						}
					}, 900);
				}
			} else {
				setDbTestResult({ ok: false, message: data.error || 'Connection failed.' });
			}
		} catch {
			setDbTestResult({ ok: false, message: 'Connection probe failed.' });
		} finally {
			setTestingDb(false);
		}
	};

	const generateNginxConfig = () => {
		const dom = domain.trim() || 'orbit.example.com';
		return `# Nginx Reverse Proxy Configuration for Orbit Community OS
# Place in /etc/nginx/sites-available/${dom} and symlink to sites-enabled/

server {
    listen 80;
    listen [::]:80;
    server_name ${dom};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${dom};

    # TLS Certificates (e.g. Certbot / Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/${dom}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${dom}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security & HSTS Headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Client upload limits for files & documents
    client_max_body_size 60M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket Upgrade Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded Client Identity
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # ESSENTIAL FOR NEXT.JS SSE STREAMS (Chat, Telemetry, Radar)
        # Prevents Nginx from buffering and hanging realtime events
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
`;
	};

	const generateCaddyConfig = () => {
		const dom = domain.trim() || 'orbit.example.com';
		return `# Caddyfile Configuration for Orbit Community OS
# Add this block to /etc/caddy/Caddyfile and reload caddy

${dom} {
    # Automatic Let's Encrypt TLS & HTTP to HTTPS redirection
    reverse_proxy 127.0.0.1:3000 {
        # Flush immediately for SSE streams
        flush_interval -1
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
`;
	};

	const handleCopyProxy = async () => {
		const configText = proxyType === 'nginx' ? generateNginxConfig() : generateCaddyConfig();
		try {
			await navigator.clipboard.writeText(configText);
			setCopiedProxy(true);
			setTimeout(() => setCopiedProxy(false), 2000);
		} catch {
			// Fallback
		}
	};

	const handleDownloadProxy = () => {
		const configText = proxyType === 'nginx' ? generateNginxConfig() : generateCaddyConfig();
		const filename = proxyType === 'nginx' ? `${domain.trim() || 'orbit'}.nginx.conf` : 'Caddyfile';
		const blob = new Blob([configText], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const [generatedDbPassword] = useState(() => {
		if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
			const buf = new Uint8Array(16);
			window.crypto.getRandomValues(buf);
			return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
		}
		return 'change_this_password';
	});

	const dockerRunCmd =
		`docker run --name orbit-postgres -e POSTGRES_DB=orbit -e POSTGRES_USER=orbit -e POSTGRES_PASSWORD=${generatedDbPassword} -p 127.0.0.1:5432:5432 -d postgres:16-alpine`;

	const handleCopyDocker = async () => {
		try {
			await navigator.clipboard.writeText(dockerRunCmd);
			setCopiedDocker(true);
			setTimeout(() => setCopiedDocker(false), 2000);
		} catch {
			// Fallback
		}
	};

	const handleTestDb = async () => {
		setError(null);
		setDbTestResult(null);
		const targetUrl = dbUrl.trim();
		if (!targetUrl) {
			setError('Please enter a PostgreSQL connection string.');
			return;
		}

		setTestingDb(true);
		try {
			const res = await fetch('/api/setup/test-db', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: targetUrl }),
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.ok) {
				if (data.databaseName) setDbName(data.databaseName);
				setDbTestResult({
					ok: true,
					message: data.message || 'PostgreSQL connection verified successfully!',
				});
				setDbConnected(true);
				setCompletedSteps((prev) => new Set(prev).add(1));
				if (data.alreadyInitialized) {
					setTimeout(() => {
						if (typeof window !== 'undefined') {
							// eslint-disable-next-line @next/next/no-location-assign-relative-destination
							window.location.href = '/';
						} else {
							onComplete();
						}
					}, 900);
				}
			} else {
				setDbTestResult({ ok: false, message: data.error || 'Connection could not be established.' });
			}
		} catch {
			setDbTestResult({ ok: false, message: 'Could not communicate with the server.' });
		} finally {
			setTestingDb(false);
		}
	};

	const validateStep = (step: WizardStep): boolean => {
		setError(null);
		if (step === 1) {
			if (!dbConnected && !dbUrl.trim()) {
				setError('Please provide a valid database connection before continuing.');
				return false;
			}
			setCompletedSteps((prev) => new Set(prev).add(1));
			return true;
		}
		if (step === 2) {
			if (!studioName.trim() || !communityName.trim() || !domain.trim()) {
				setError('Please complete all studio and community identity fields.');
				return false;
			}
			setCompletedSteps((prev) => new Set(prev).add(2));
			return true;
		}
		if (step === 3) {
			if (!ad.trim() || !soyad.trim()) {
				setError('Administrator first name and last name are required.');
				return false;
			}
			if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
				setError('Please enter a valid administrator email address.');
				return false;
			}
			if (password.length < 12) {
				setError('Administrator password must be at least 12 characters.');
				return false;
			}
			if (password !== passwordConfirm) {
				setError('Passwords do not match.');
				return false;
			}
			setCompletedSteps((prev) => new Set(prev).add(3));
			return true;
		}
		if (step === 4) {
			setCompletedSteps((prev) => new Set(prev).add(4));
			return true;
		}
		return true;
	};

	const goToStep = (target: WizardStep) => {
		if (target < currentStep) {
			setError(null);
			setCurrentStep(target);
		} else if (validateStep(currentStep)) {
			setCurrentStep(target);
		}
	};

	const nextStep = () => {
		if (validateStep(currentStep)) {
			const next = Math.min(5, currentStep + 1) as WizardStep;
			setCurrentStep(next);
		}
	};

	const prevStep = () => {
		setError(null);
		setCurrentStep((prev) => Math.max(1, prev - 1) as WizardStep);
	};

	const handleCompleteSetup = async () => {
		setError(null);
		setLoading(true);
		setLaunching(true);

		const payload = {
			dbUrl: dbUrl.trim() || undefined,
			studioName: studioName.trim(),
			communityName: communityName.trim(),
			domain: domain.trim(),
			ad: ad.trim(),
			soyad: soyad.trim(),
			email: email.trim(),
			password,
			smtpHost: smtpHost.trim() || undefined,
			smtpPort: Number(smtpPort) || 465,
			smtpUser: smtpUser.trim() || undefined,
			smtpPassword: smtpPassword || undefined,
			smtpFrom: smtpFrom.trim() || undefined,
		};

		try {
			const res = await fetch('/api/setup/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				const errMsg = String(data.error || 'Setup could not be completed.');
				setError(errMsg);
				setLoading(false);
				setLaunching(false);
				if (errMsg.toLowerCase().includes('already complete') || errMsg.toLowerCase().includes('already exists')) {
					setTimeout(() => {
						if (typeof window !== 'undefined') {
							// eslint-disable-next-line @next/next/no-location-assign-relative-destination
							window.location.href = '/';
						} else {
							onComplete();
						}
					}, 1000);
				}
				return;
			}

			setCompletedSteps((prev) => new Set(prev).add(5));

			// Smooth launch transition
			setTimeout(() => {
				if (typeof window !== 'undefined') {
					// eslint-disable-next-line @next/next/no-location-assign-relative-destination
					window.location.href = '/';
				} else {
					onComplete();
				}
			}, 1200);
		} catch {
			setError('An error occurred while connecting to the setup endpoint.');
			setLoading(false);
			setLaunching(false);
		}
	};

	const completedCount = completedSteps.size;
	const progressPercent = Math.round((completedCount / 5) * 100);
	const activeMeta = STEP_METAS[currentStep];

	return (
		<div className={styles.workbench}>
			{/* Setup Splitview Body */}
			<div className={styles.workbenchBody}>
				{/* Walkthrough Steps Sidebar */}
				<nav className={styles.sidebar} aria-label="Walkthrough Steps">
					<div className={styles.sidebarHeader}>
						<div className={styles.sidebarSectionTag}>Setup Walkthrough</div>
						<h2 className={styles.sidebarTitle}>Getting Started</h2>
						<div className={styles.progressTrack}>
							<div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
						</div>
						<div className={styles.progressLabel}>
							{completedCount} of 5 completed ({progressPercent}%)
						</div>
					</div>

					<div className={styles.stepList}>
						{([1, 2, 3, 4, 5] as WizardStep[]).map((stepNum) => {
							const meta = STEP_METAS[stepNum];
							const isActive = currentStep === stepNum;
							const isDone = completedSteps.has(stepNum);

							return (
								<button
									key={stepNum}
									type="button"
									onClick={() => goToStep(stepNum)}
									className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''}`}
								>
									<div
										className={`${styles.stepBadge} ${
											isDone
												? styles.stepBadgeDone
												: isActive
													? styles.stepBadgeActive
													: styles.stepBadgePending
										}`}
									>
										{isDone ? <Check size={12} /> : stepNum}
									</div>
									<div className={styles.stepItemInfo}>
										<span className={styles.stepItemTitle}>{meta.navTitle}</span>
										<span className={styles.stepItemSubtitle}>{meta.navSubtitle}</span>
									</div>
								</button>
							);
						})}
					</div>
				</nav>

				{/* Right Editor Canvas — ONE TITLE DISPLAYED PER SELECTION */}
				<main className={styles.canvas}>
					{/* Selection Header */}
					<div className={styles.selectionHeader}>
						<div className={styles.selectionStepPill}>
							STEP {activeMeta.number} OF 5 // {activeMeta.navTitle.toUpperCase()}
						</div>
						<h1 className={styles.selectionTitle}>{activeMeta.title}</h1>
						<p className={styles.selectionDescription}>{activeMeta.description}</p>
					</div>

					{/* Error Notification */}
					{error && (
						<div className={styles.alertError}>
							<AlertCircle size={16} style={{ flexShrink: 0 }} />
							<span>{error}</span>
						</div>
					)}

					{/* Step 1: Database Engine */}
					{currentStep === 1 && (
						<div className={styles.selectionBody}>
							{dbConnected ? (
								<div className={styles.alertSuccess}>
									<CheckCircle2 size={18} style={{ flexShrink: 0 }} />
									<div>
										<strong style={{ color: '#ffffff', display: 'block' }}>
											PostgreSQL Database Online
										</strong>
										<span style={{ fontSize: '12px', color: '#9cdcfe' }}>
											{dbName ? `Active database catalog: ${dbName}` : 'Database verified and ready for schema bootstrap.'}
										</span>
									</div>
								</div>
							) : (
								<div className={styles.alertInfo}>
									<Database size={18} style={{ flexShrink: 0 }} />
									<div>
										<strong style={{ color: '#ffffff', display: 'block' }}>
											Database Connection Required
										</strong>
										<span style={{ fontSize: '12px', color: '#9cdcfe' }}>
											Orbit stores all runtime settings, encryption keys, and community states in PostgreSQL.
										</span>
									</div>
								</div>
							)}

							{/* Auto-detected Instances */}
							{detectedCandidates.length > 0 && (
								<div className={styles.card}>
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
											<Cpu size={15} style={{ color: '#4ec9b0' }} />
											<span>Auto-Detected PostgreSQL Instances ({detectedCandidates.length})</span>
										</div>
										<button
											type="button"
											onClick={() => void scanDatabases()}
											disabled={scanningDb}
											className={`${styles.btnSecondary} ${styles.btnSmall}`}
										>
											<RefreshCw size={12} className={scanningDb ? 'animate-spin' : ''} />
											<span>Re-scan</span>
										</button>
									</div>

									<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
										{detectedCandidates.map((cand, idx) => (
											<div
												key={idx}
												style={{
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													padding: '8px 12px',
													backgroundColor: '#1e1e1e',
													border: '1px solid #333333',
													borderRadius: '3px',
												}}
											>
												<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
													<Server size={14} style={{ color: '#569cd6' }} />
													<div>
														<div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
															{cand.label}
														</div>
														<div style={{ fontSize: '11px', color: '#888888', fontFamily: 'monospace' }}>
															{cand.host} · DB: {cand.dbName} ({cand.type})
														</div>
													</div>
												</div>
												<button
													type="button"
													onClick={() => void handleSelectCandidate(cand.url)}
													disabled={testingDb}
													className={`${styles.btnPrimary} ${styles.btnSmall}`}
												>
													<span>Select</span>
												</button>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Manual Connection Input */}
							<div className={styles.formGroup}>
								<label className={styles.label}>PostgreSQL Connection String</label>
								<div style={{ display: 'flex', gap: '8px' }}>
									<div className={styles.inputWrap} style={{ flex: 1 }}>
										<Database size={15} className={styles.inputIcon} />
										<input
											type="text"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={dbUrl}
											onChange={(e) => setDbUrl(e.target.value)}
											placeholder="postgresql://orbit:<password>@localhost:5432/orbit"
										/>
									</div>
									<button
										type="button"
										onClick={handleTestDb}
										disabled={testingDb || !dbUrl.trim()}
										className={styles.btnSecondary}
									>
										{testingDb ? <RefreshCw size={14} className="animate-spin" /> : <Terminal size={14} />}
										<span>{testingDb ? 'Testing...' : 'Test Connection'}</span>
									</button>
								</div>
								<p className={styles.helperText}>
									Accepts formats like <code style={{ color: '#ce9178' }}>postgresql://user:pass@host:5432/dbname</code>.
								</p>
							</div>

							{dbTestResult && (
								<div className={dbTestResult.ok ? styles.alertSuccess : styles.alertError}>
									{dbTestResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
									<span>{dbTestResult.message}</span>
								</div>
							)}

							{/* Docker Helper Dropdown */}
							<div className={styles.card}>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										cursor: 'pointer',
									}}
									onClick={() => setShowDockerSnippet((prev) => !prev)}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500 }}>
										<Terminal size={14} style={{ color: '#0078d4' }} />
										<span>Need a PostgreSQL container? One-click Docker snippet</span>
									</div>
									<span style={{ fontSize: '11px', color: '#888888' }}>
										{showDockerSnippet ? 'Hide' : 'Show command'}
									</span>
								</div>

								{showDockerSnippet && (
									<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
										<div className={styles.codeBox}>{dockerRunCmd}</div>
										<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
											<button
												type="button"
												onClick={handleCopyDocker}
												className={`${styles.btnSecondary} ${styles.btnSmall}`}
											>
												{copiedDocker ? <Check size={12} /> : <Copy size={12} />}
												<span>{copiedDocker ? 'Copied' : 'Copy Docker Command'}</span>
											</button>
										</div>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Step 2: Workspace Identity & Reverse Proxy */}
					{currentStep === 2 && (
						<div className={styles.selectionBody}>
							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label className={styles.label}>Studio / Creator Organization</label>
									<div className={styles.inputWrap}>
										<Building2 size={15} className={styles.inputIcon} />
										<input
											type="text"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={studioName}
											onChange={(e) => setStudioName(e.target.value)}
											placeholder="tetha42"
											required
										/>
									</div>
									<p className={styles.helperText}>The engineering studio or entity maintaining this deployment.</p>
								</div>

								<div className={styles.formGroup}>
									<label className={styles.label}>Community Workspace Name</label>
									<div className={styles.inputWrap}>
										<Sparkles size={15} className={styles.inputIcon} />
										<input
											type="text"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={communityName}
											onChange={(e) => setCommunityName(e.target.value)}
											placeholder="Orbit Community"
											required
										/>
									</div>
									<p className={styles.helperText}>The organization or club title presented to members and documents.</p>
								</div>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.label}>Primary Domain (FQDN)</label>
								<div className={styles.inputWrap}>
									<Globe size={15} className={styles.inputIcon} />
									<input
										type="text"
										className={`${styles.input} ${styles.inputWithIcon}`}
										value={domain}
										onChange={(e) => setDomain(e.target.value)}
										placeholder="orbit.example.com"
										required
									/>
								</div>
								<p className={styles.helperText}>The public domain or local hostname where members will access Orbit.</p>
							</div>

							{/* Reverse Proxy Assistant */}
							<div className={styles.card}>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										cursor: 'pointer',
									}}
									onClick={() => setShowProxyConfig((prev) => !prev)}
								>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500 }}>
										<Server size={14} style={{ color: '#b180d7' }} />
										<span>Reverse Proxy Assistant (Nginx & Caddy Configuration)</span>
									</div>
									<span style={{ fontSize: '11px', color: '#888888' }}>
										{showProxyConfig ? 'Hide' : 'Configure Proxy'}
									</span>
								</div>

								{showProxyConfig && (
									<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
										<div style={{ display: 'flex', gap: '6px' }}>
											<button
												type="button"
												onClick={() => setProxyType('nginx')}
												className={proxyType === 'nginx' ? styles.btnPrimary : styles.btnSecondary}
												style={{ height: '26px', fontSize: '12px' }}
											>
												Nginx
											</button>
											<button
												type="button"
												onClick={() => setProxyType('caddy')}
												className={proxyType === 'caddy' ? styles.btnPrimary : styles.btnSecondary}
												style={{ height: '26px', fontSize: '12px' }}
											>
												Caddy
											</button>
										</div>

										<div className={styles.codeBox} style={{ maxHeight: '180px', overflowY: 'auto' }}>
											<pre style={{ margin: 0, fontFamily: 'inherit', color: 'inherit' }}>
												{proxyType === 'nginx' ? generateNginxConfig() : generateCaddyConfig()}
											</pre>
										</div>

										<div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
											<button
												type="button"
												onClick={handleCopyProxy}
												className={`${styles.btnSecondary} ${styles.btnSmall}`}
											>
												{copiedProxy ? <Check size={12} /> : <Copy size={12} />}
												<span>{copiedProxy ? 'Copied' : 'Copy'}</span>
											</button>
											<button
												type="button"
												onClick={handleDownloadProxy}
												className={`${styles.btnSecondary} ${styles.btnSmall}`}
											>
												<Download size={12} />
												<span>Download</span>
											</button>
										</div>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Step 3: Root Administrator */}
					{currentStep === 3 && (
						<div className={styles.selectionBody}>
							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label className={styles.label}>First Name</label>
									<div className={styles.inputWrap}>
										<User size={15} className={styles.inputIcon} />
										<input
											type="text"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={ad}
											onChange={(e) => setAd(e.target.value)}
											placeholder="Orbit"
											required
										/>
									</div>
								</div>
								<div className={styles.formGroup}>
									<label className={styles.label}>Last Name</label>
									<div className={styles.inputWrap}>
										<User size={15} className={styles.inputIcon} />
										<input
											type="text"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={soyad}
											onChange={(e) => setSoyad(e.target.value)}
											placeholder="Admin"
											required
										/>
									</div>
								</div>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.label}>Administrator Email</label>
								<div className={styles.inputWrap}>
									<Mail size={15} className={styles.inputIcon} />
									<input
										type="email"
										className={`${styles.input} ${styles.inputWithIcon}`}
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="admin@orbit.local"
										required
									/>
								</div>
								<p className={styles.helperText}>Used for login and root administration privileges.</p>
							</div>

							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
										<label className={styles.label}>Administrator Password</label>
										<span
											style={{
												fontSize: '11px',
												fontFamily: 'monospace',
												color: password.length >= 12 ? '#4ec9b0' : '#888888',
											}}
										>
											{password.length}/12+ chars
										</span>
									</div>
									<div className={styles.inputWrap}>
										<Lock size={15} className={styles.inputIcon} />
										<input
											type="password"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											placeholder="Minimum 12 characters"
											required
										/>
									</div>
								</div>

								<div className={styles.formGroup}>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
										<label className={styles.label}>Confirm Password</label>
										{password && passwordConfirm && (
											<span
												style={{
													fontSize: '11px',
													color: password === passwordConfirm ? '#4ec9b0' : '#f48771',
												}}
											>
												{password === passwordConfirm ? '✓ Match' : 'Mismatch'}
											</span>
										)}
									</div>
									<div className={styles.inputWrap}>
										<Lock size={15} className={styles.inputIcon} />
										<input
											type="password"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={passwordConfirm}
											onChange={(e) => setPasswordConfirm(e.target.value)}
											placeholder="Re-enter password"
											required
										/>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Step 4: Outbound Mail (SMTP) */}
					{currentStep === 4 && (
						<div className={styles.selectionBody}>
							<p style={{ margin: 0, fontSize: '12.5px', color: '#a1a1aa', lineHeight: 1.5 }}>
								Configure an outbound SMTP relay to send automated verification emails, notifications, and security alerts. You may skip this step and configure it later from System Settings.
							</p>

							<div className={styles.formRow}>
								<div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
									<label className={styles.label}>SMTP Host</label>
									<div className={styles.inputWrap}>
										<Server size={15} className={styles.inputIcon} />
										<input
											type="text"
											className={`${styles.input} ${styles.inputWithIcon}`}
											value={smtpHost}
											onChange={(e) => setSmtpHost(e.target.value)}
											placeholder="smtp.example.com"
										/>
									</div>
								</div>
							</div>

							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label className={styles.label}>Port</label>
									<input
										type="text"
										className={styles.input}
										value={smtpPort}
										onChange={(e) => setSmtpPort(e.target.value)}
										placeholder="465"
									/>
								</div>
								<div className={styles.formGroup}>
									<label className={styles.label}>Sender Address (From)</label>
									<input
										type="text"
										className={styles.input}
										value={smtpFrom}
										onChange={(e) => setSmtpFrom(e.target.value)}
										placeholder={`"${communityName}" <noreply@${domain}>`}
									/>
								</div>
							</div>

							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label className={styles.label}>SMTP Username</label>
									<input
										type="text"
										className={styles.input}
										value={smtpUser}
										onChange={(e) => setSmtpUser(e.target.value)}
										placeholder="noreply@domain.com"
									/>
								</div>
								<div className={styles.formGroup}>
									<label className={styles.label}>SMTP Password</label>
									<input
										type="password"
										className={styles.input}
										value={smtpPassword}
										onChange={(e) => setSmtpPassword(e.target.value)}
										placeholder="••••••••"
									/>
								</div>
							</div>
						</div>
					)}

					{/* Step 5: Review & Launch */}
					{currentStep === 5 && (
						<div className={styles.selectionBody}>
							{launching ? (
								<div
									style={{
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: '16px',
										padding: '48px 16px',
										textAlign: 'center',
									}}
								>
									<div className="boot-splash__spinner" style={{ width: '40px', height: '40px' }} />
									<div>
										<h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 6px 0' }}>
											Provisioning Orbit Community OS...
										</h3>
										<p style={{ fontSize: '12.5px', color: '#888888', margin: 0 }}>
											Migrating PostgreSQL schemas, initializing system roles, and creating administrator session.
										</p>
									</div>
								</div>
							) : (
								<div className={styles.card}>
									<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
											<span style={{ color: '#888888' }}>Studio Organization</span>
											<span style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>{studioName}</span>
										</div>
										<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
											<span style={{ color: '#888888' }}>Community Workspace</span>
											<span style={{ fontWeight: 600, color: '#ffffff' }}>{communityName}</span>
										</div>
										<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
											<span style={{ color: '#888888' }}>Primary Domain</span>
											<span style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>{domain}</span>
										</div>
										<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
											<span style={{ color: '#888888' }}>Root Administrator</span>
											<span style={{ fontWeight: 600, color: '#ffffff' }}>
												{ad} {soyad} ({email})
											</span>
										</div>
										<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
											<span style={{ color: '#888888' }}>SMTP Email Relay</span>
											<span style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>
												{smtpHost ? `${smtpHost}:${smtpPort}` : 'Disabled (configure later)'}
											</span>
										</div>
										<div style={{ display: 'flex', justifyContent: 'space-between' }}>
											<span style={{ color: '#888888' }}>Database Engine</span>
											<span style={{ fontWeight: 600, color: '#4ec9b0', fontFamily: 'monospace' }}>
												{dbConnected ? 'PostgreSQL Verified ✓' : 'Direct Connection'}
											</span>
										</div>
									</div>
								</div>
							)}

							<div className={styles.card} style={{ marginTop: '12px' }}>
								<h3 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
									Provisioned workspace defaults
								</h3>
								<p style={{ margin: '0 0 12px', fontSize: '11.5px', lineHeight: 1.5, color: '#9d9d9d' }}>
									Everything below is written to PostgreSQL in English during initialization and can be changed later in Settings.
								</p>
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: '11.5px' }}>
									<div>
										<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>Access roles</strong>
										<span style={{ color: '#9d9d9d' }}>Admin · Management Board · Member · Alumni</span>
									</div>
									<div>
										<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>Team categories</strong>
										<span style={{ color: '#9d9d9d' }}>{DEFAULT_TEAM_CATEGORIES.join(' · ')}</span>
									</div>
									<div>
										<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>Registration form</strong>
										<span style={{ color: '#9d9d9d' }}>
											{DEFAULT_REGISTRATION_CORE_CONFIG.track.options.length} tracks · {DEFAULT_REGISTRATION_CORE_CONFIG.level.options.length} experience levels
										</span>
									</div>
									<div>
										<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>Legal & branding</strong>
										<span style={{ color: '#9d9d9d' }}>3 agreements · identity · favicon/PWA icon pipeline</span>
									</div>
								</div>
								<div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #333333', fontSize: '11.5px', lineHeight: 1.55, color: '#9d9d9d' }}>
									<strong style={{ color: '#ffffff' }}>After launch:</strong> sign in with the root administrator and enroll two-factor authentication. Then review Settings → Identity & Branding, Registration & Member Form, Teams and Roles & Permissions before inviting members.
								</div>
							</div>
						</div>
					)}

					{/* Walkthrough Action Buttons */}
					<div className={styles.buttonRow}>
						{currentStep > 1 ? (
							<button
								type="button"
								onClick={prevStep}
								disabled={loading}
								className={styles.btnSecondary}
							>
								<ArrowLeft size={14} />
								<span>Previous Step</span>
							</button>
						) : (
							<div />
						)}

						{currentStep < 5 ? (
							<button
								type="button"
								onClick={nextStep}
								className={styles.btnPrimary}
							>
								<span>{activeMeta.nextLabel}</span>
								<ArrowRight size={14} />
							</button>
						) : (
							<button
								type="button"
								onClick={handleCompleteSetup}
								disabled={loading}
								className={styles.btnPrimary}
								style={{ backgroundColor: '#107c41' }}
							>
								<CheckCircle2 size={15} />
								<span>Initialize & Launch Workspace</span>
							</button>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
