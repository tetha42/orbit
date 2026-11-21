import React, { useState } from 'react';
import { Check, Copy, Download, Server } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from '../VsCodeSetup.module.css';
import { generateNginxConfig } from './proxyTemplates';
import { downloadTextFile } from './setupApi';

interface ProxyAssistantCardProps {
	domain: string;
}

export function ProxyAssistantCard({ domain }: ProxyAssistantCardProps) {
	const { t } = useI18n();
	const [showProxyConfig, setShowProxyConfig] = useState(false);
	const [copiedProxy, setCopiedProxy] = useState(false);

	const proxyConfigText = generateNginxConfig(domain);

	const handleCopyProxy = async () => {
		try {
			await navigator.clipboard.writeText(proxyConfigText);
			setCopiedProxy(true);
			setTimeout(() => setCopiedProxy(false), 2000);
		} catch {
			// Fallback when clipboard access is unavailable
		}
	};

	const handleDownloadProxy = () => {
		const filename = `${domain.trim() || 'orbit'}.nginx.conf`;
		downloadTextFile(filename, proxyConfigText);
	};

	return (
		<div className={styles.card}>
			<button
				type="button"
				onClick={() => setShowProxyConfig((prev) => !prev)}
				aria-expanded={showProxyConfig}
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					width: '100%',
					background: 'none',
					border: 'none',
					padding: 0,
					color: 'inherit',
					cursor: 'pointer',
					textAlign: 'left',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500 }}>
					<Server size={14} style={{ color: '#b180d7' }} />
					<span>{t('setupProxyTitle')}</span>
				</div>
				<span style={{ fontSize: '11px', color: '#888888' }}>
					{showProxyConfig ? t('setupProxyHide') : t('setupProxyShow')}
				</span>
			</button>

			{showProxyConfig && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
					<div className={styles.codeBox} style={{ maxHeight: '180px', overflowY: 'auto' }}>
						<pre style={{ margin: 0, fontFamily: 'inherit', color: 'inherit' }}>{proxyConfigText}</pre>
					</div>

					<div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
						<button
							type="button"
							onClick={handleCopyProxy}
							className={`${styles.btnSecondary} ${styles.btnSmall}`}
						>
							{copiedProxy ? <Check size={12} /> : <Copy size={12} />}
							<span>{copiedProxy ? t('setupProxyCopied') : t('setupProxyCopy')}</span>
						</button>
						<button
							type="button"
							onClick={handleDownloadProxy}
							className={`${styles.btnSecondary} ${styles.btnSmall}`}
						>
							<Download size={12} />
							<span>{t('setupProxyDownload')}</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
