import React, { useState } from 'react';
import { AlertCircle, Check, Copy, Eye, EyeOff, KeyRound, LockOpen, Terminal } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import styles from '../VsCodeSetup.module.css';

interface SetupUnlockGateProps {
	unlocking: boolean;
	error: string | null;
	onUnlock: (token: string) => Promise<void>;
}

export function SetupUnlockGate({ unlocking, error, onUnlock }: SetupUnlockGateProps) {
	const { t } = useI18n();
	const [token, setToken] = useState('');
	const [showToken, setShowToken] = useState(false);
	const [copiedCommand, setCopiedCommand] = useState(false);

	const lookupCmd = './bin/orbit setup url';

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (unlocking || !token.trim()) return;
		void onUnlock(token);
	};

	const handleCopyCommand = async () => {
		try {
			await navigator.clipboard.writeText(lookupCmd);
			setCopiedCommand(true);
			setTimeout(() => setCopiedCommand(false), 2000);
		} catch {
			// Ignore clipboard failures when browser denies access
		}
	};

	const [hintPrefix, hintSuffix] = fill(t('setupGateTokenHint'), { file: '__FILE__' }).split('__FILE__');

	return (
		<div className={styles.workbench} style={{ maxWidth: '640px', height: 'auto' }}>
			<div className={styles.canvas} style={{ padding: '32px' }}>
				<div className={styles.selectionHeader}>
					<div className={styles.selectionStepPill}>{t('setupGatePill')}</div>
					<h1 className={styles.selectionTitle}>{t('setupGateTitle')}</h1>
					<p className={styles.selectionDescription}>{t('setupGateDesc')}</p>
				</div>

				<div className={styles.selectionBody}>
					{error && (
						<div className={styles.alertError}>
							<AlertCircle size={16} style={{ flexShrink: 0 }} />
							<span>{error}</span>
						</div>
					)}

					<form onSubmit={handleSubmit} className={styles.formGroup}>
						<label className={styles.label} htmlFor="orbit-setup-token-input">
							{t('setupGateTokenLabel')}
						</label>
						<div style={{ display: 'flex', gap: '8px' }}>
							<div className={styles.inputWrap} style={{ flex: 1 }}>
								<KeyRound size={15} className={styles.inputIcon} />
								<input
									id="orbit-setup-token-input"
									type={showToken ? 'text' : 'password'}
									className={`${styles.input} ${styles.inputWithIcon}`}
									value={token}
									onChange={(e) => setToken(e.target.value)}
									placeholder={t('setupGateTokenPh')}
									autoComplete="off"
									spellCheck={false}
								/>
							</div>
							<button
								type="button"
								onClick={() => setShowToken((prev) => !prev)}
								className={styles.btnSecondary}
								aria-label={showToken ? t('setupGateHideToken') : t('setupGateShowToken')}
							>
								{showToken ? <EyeOff size={14} /> : <Eye size={14} />}
							</button>
							<button
								type="submit"
								disabled={unlocking || !token.trim()}
								className={styles.btnPrimary}
							>
								<LockOpen size={14} />
								<span>{unlocking ? t('setupGateUnlocking') : t('setupGateUnlockBtn')}</span>
							</button>
						</div>
					</form>

					<div className={styles.card}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500 }}>
								<Terminal size={14} />
								<span>{t('setupGateHostHint')}</span>
							</div>
							<button
								type="button"
								onClick={() => void handleCopyCommand()}
								className={`${styles.btnSecondary} ${styles.btnSmall}`}
							>
								{copiedCommand ? <Check size={12} /> : <Copy size={12} />}
								<span>{copiedCommand ? t('copied') : t('terminalCopy')}</span>
							</button>
						</div>
						<div className={styles.codeBox}>{lookupCmd}</div>
						<p className={styles.helperText}>
							{hintPrefix}
							<code style={{ color: 'var(--syntax-string)' }}>data/orbit.setup.token</code>
							{hintSuffix}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
