import React from 'react';
import {
	AlertCircle,
	CheckCircle2,
	Cpu,
	Database,
	RefreshCw,
	Server,
	Terminal,
} from 'lucide-react';
import styles from '../VsCodeSetup.module.css';
import type { DetectedCandidate } from './setupTypes';
import { DockerDbSnippet } from './DockerDbSnippet';

interface StepDatabaseProps {
	dbConnected: boolean;
	dbName: string;
	detectedCandidates: DetectedCandidate[];
	scanningDb: boolean;
	testingDb: boolean;
	dbUrl: string;
	onDbUrlChange: (value: string) => void;
	dbTestResult: { ok: boolean; message: string } | null;
	generatedDbPassword: string;
	onScanDatabases: () => void;
	onSelectCandidate: (candidate: DetectedCandidate) => void;
	onTestDb: () => void;
}

export function StepDatabase({
	dbConnected,
	dbName,
	detectedCandidates,
	scanningDb,
	testingDb,
	dbUrl,
	onDbUrlChange,
	dbTestResult,
	generatedDbPassword,
	onScanDatabases,
	onSelectCandidate,
	onTestDb,
}: StepDatabaseProps) {
	return (
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
				<div className={styles.alertInfo} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
					<button
						type="button"
						onClick={onScanDatabases}
						disabled={scanningDb}
						className={`${styles.btnSecondary} ${styles.btnSmall}`}
					>
						<RefreshCw size={12} className={scanningDb ? 'animate-spin' : ''} />
						<span>{scanningDb ? 'Scanning...' : 'Scan Docker / Local'}</span>
					</button>
				</div>
			)}

			{detectedCandidates.length > 0 && (
				<div className={styles.card}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
							<Cpu size={15} style={{ color: '#4ec9b0' }} />
							<span>Auto-Detected PostgreSQL Instances ({detectedCandidates.length})</span>
						</div>
						<button
							type="button"
							onClick={onScanDatabases}
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
								key={cand.id ?? idx}
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
									onClick={() => onSelectCandidate(cand)}
									disabled={testingDb}
									className={`${styles.btnPrimary} ${styles.btnSmall}`}
								>
									<span>Connect</span>
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			<div className={styles.formGroup}>
				<label className={styles.label}>PostgreSQL Connection String</label>
				<div style={{ display: 'flex', gap: '8px' }}>
					<div className={styles.inputWrap} style={{ flex: 1 }}>
						<Database size={15} className={styles.inputIcon} />
						<input
							type="text"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={dbUrl}
							onChange={(e) => onDbUrlChange(e.target.value)}
							placeholder="postgresql://orbit:<password>@127.0.0.1:5432/orbit"
						/>
					</div>
					<button
						type="button"
						onClick={onTestDb}
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

			<DockerDbSnippet
				dbUrl={dbUrl}
				generatedDbPassword={generatedDbPassword}
				scanningDb={scanningDb}
				onDbUrlChange={onDbUrlChange}
				onScanDatabases={onScanDatabases}
			/>
		</div>
	);
}
