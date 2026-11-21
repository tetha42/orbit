import React, { useState } from 'react';
import { Check, Copy, RefreshCw, Terminal } from 'lucide-react';
import styles from '../VsCodeSetup.module.css';

interface DockerDbSnippetProps {
	dbUrl: string;
	generatedDbPassword: string;
	scanningDb: boolean;
	onDbUrlChange: (value: string) => void;
	onScanDatabases: () => void;
}

type SnippetMode = 'cli' | 'docker';

export function DockerDbSnippet({
	dbUrl,
	generatedDbPassword,
	scanningDb,
	onDbUrlChange,
	onScanDatabases,
}: DockerDbSnippetProps) {
	const [showSnippet, setShowSnippet] = useState(false);
	const [mode, setMode] = useState<SnippetMode>('cli');
	const [copied, setCopied] = useState(false);

	const cliCommand = 'make db-up';
	const dockerRunCommand =
		`docker run --name orbit-db -e POSTGRES_DB=orbit -e POSTGRES_USER=orbit -e POSTGRES_PASSWORD=${generatedDbPassword} -p 127.0.0.1:5432:5432 -d postgres:16-alpine`;
	const activeCommand = mode === 'cli' ? cliCommand : dockerRunCommand;

	const handleCopy = async () => {
		if (!dbUrl.trim()) {
			const pass = mode === 'cli' ? 'orbit_dev_2026' : generatedDbPassword;
			onDbUrlChange(`postgresql://orbit:${pass}@127.0.0.1:5432/orbit`);
		}
		try {
			await navigator.clipboard.writeText(activeCommand);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Fallback when clipboard permission is unavailable
		}
	};

	return (
		<div className={styles.card}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					cursor: 'pointer',
				}}
				onClick={() => setShowSnippet((prev) => !prev)}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500 }}>
					<Terminal size={14} style={{ color: 'var(--ink-vs-accent)' }} />
					<span>Need a PostgreSQL container? One-click Dev CLI or Docker</span>
				</div>
				<span style={{ fontSize: '11px', color: 'var(--ink-vs-subtle)' }}>
					{showSnippet ? 'Hide' : 'Show command'}
				</span>
			</div>

			{showSnippet && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
					<div style={{ display: 'flex', gap: '6px' }}>
						<button
							type="button"
							onClick={() => setMode('cli')}
							className={`${mode === 'cli' ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSmall}`}
						>
							<span>Dev CLI (Recommended)</span>
						</button>
						<button
							type="button"
							onClick={() => setMode('docker')}
							className={`${mode === 'docker' ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSmall}`}
						>
							<span>Standalone Docker</span>
						</button>
					</div>

					<div className={styles.codeBox}>{activeCommand}</div>

					<p className={styles.helperText}>
						{mode === 'cli'
							? 'Uses infra/docker/docker-compose.dev.yml (127.0.0.1:5432, container: orbit-db). Also available via ./bin/orbit db up.'
							: 'Starts a standalone local PostgreSQL 16 container named orbit-db with a generated password.'}
					</p>

					<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
						<button
							type="button"
							onClick={onScanDatabases}
							disabled={scanningDb}
							className={`${styles.btnSecondary} ${styles.btnSmall}`}
						>
							<RefreshCw size={12} className={scanningDb ? 'animate-spin' : ''} />
							<span>Scan for Container</span>
						</button>
						<button
							type="button"
							onClick={() => void handleCopy()}
							className={`${styles.btnSecondary} ${styles.btnSmall}`}
						>
							{copied ? <Check size={12} /> : <Copy size={12} />}
							<span>{copied ? 'Copied' : 'Copy Command'}</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
