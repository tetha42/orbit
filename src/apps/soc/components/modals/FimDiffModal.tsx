'use client';

import React, { useEffect, useState } from 'react';
import { X, FileCode, GitCompare, Copy, Check, Columns, FileText } from 'lucide-react';
import { useI18n } from '@/core/i18n/I18nProvider';
import { MODALS_I18N } from './i18nModals';
import { FimDiffViewport, type FimDiffData } from './FimDiffViewport';
import styles from './SocModals.module.css';

interface FimDiffModalProps {
	filePath: string;
	onClose: () => void;
}

export const FimDiffModal: React.FC<FimDiffModalProps> = ({ filePath, onClose }) => {
	const { language } = useI18n();
	const copy = MODALS_I18N[language] ?? MODALS_I18N.en;

	const [loading, setLoading] = useState(true);
	const [data, setData] = useState<FimDiffData | null>(null);
	const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let isMounted = true;
		setLoading(true);

		fetch(`/api/soc/inspection?action=diff&path=${encodeURIComponent(filePath)}`)
			.then((res) => res.json())
			.then((json) => {
				if (!isMounted) return;
				setData(
					json.diff ?? {
						path: filePath,
						status: 'not_found',
						originalContent: '',
						currentContent: '',
						diff: '',
						error: json.error || copy.fimDiffFetchError,
					}
				);
				setLoading(false);
			})
			.catch((err) => {
				if (!isMounted) return;
				setData({
					path: filePath,
					status: 'not_found',
					originalContent: '',
					currentContent: '',
					diff: '',
					error: String(err),
				});
				setLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [filePath, copy.fimDiffFetchError]);

	const handleCopy = () => {
		const textToCopy = data?.diff || data?.currentContent || '';
		if (!textToCopy) return;
		navigator.clipboard.writeText(textToCopy);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const statusBg =
		data?.status === 'modified'
			? 'color-mix(in srgb, var(--warning) 15%, transparent)'
			: data?.status === 'added'
			? 'color-mix(in srgb, var(--success) 15%, transparent)'
			: 'color-mix(in srgb, var(--danger) 15%, transparent)';
	const statusColor =
		data?.status === 'modified'
			? 'var(--warning)'
			: data?.status === 'added'
			? 'var(--success)'
			: 'var(--danger)';

	return (
		<div className={styles.backdrop} onClick={onClose}>
			<div className={styles.diffModal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.modalHeader}>
					<div className={styles.modalHeaderTitle}>
						<GitCompare size={15} style={{ color: 'var(--accent)' }} />
						<span>{copy.fimDiffTitle}</span>
						<span
							style={{
								fontSize: '11px',
								fontWeight: 600,
								padding: '2px 8px',
								borderRadius: '4px',
								background: statusBg,
								color: statusColor,
							}}
						>
							{data?.status?.toUpperCase() || 'INSPECTING'}
						</span>
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<button
							type="button"
							className={styles.btn}
							onClick={() => setViewMode(viewMode === 'split' ? 'unified' : 'split')}
							title={copy.fimDiffToggleTitle}
						>
							{viewMode === 'split' ? <FileText size={13} /> : <Columns size={13} />}
							<span>{viewMode === 'split' ? copy.fimDiffUnified : copy.fimDiffSplit}</span>
						</button>

						<button
							type="button"
							className={styles.btn}
							onClick={handleCopy}
							disabled={loading || !data}
							title={copy.fimDiffCopyTitle}
						>
							{copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
							<span>{copied ? copy.fimDiffCopied : copy.fimDiffCopy}</span>
						</button>

						<button type="button" className={styles.closeBtn} onClick={onClose} aria-label={copy.fimDiffClose}>
							<X size={15} />
						</button>
					</div>
				</div>

				<div
					style={{
						padding: '8px 18px',
						background: 'var(--fill-soft)',
						borderBottom: '1px solid var(--border-subtle)',
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						fontSize: '11.5px',
						fontFamily: 'monospace',
					}}
				>
					<FileCode size={13} style={{ color: 'var(--text-secondary)' }} />
					<span style={{ fontWeight: 600 }}>{filePath}</span>
				</div>

				<div className={styles.modalBody} style={{ flex: 1, minHeight: 0, padding: '14px' }}>
					<FimDiffViewport loading={loading} data={data} viewMode={viewMode} copy={copy} />
				</div>

				<div className={styles.modalFooter}>
					<button type="button" className={styles.btn} onClick={onClose}>
						{copy.fimDiffClose}
					</button>
				</div>
			</div>
		</div>
	);
};

export default FimDiffModal;
