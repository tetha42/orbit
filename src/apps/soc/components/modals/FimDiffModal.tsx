'use client';

import React, { useEffect, useState } from 'react';
import { X, FileCode, GitCompare, Copy, Check, Columns, FileText } from 'lucide-react';
import { useI18n } from '@/core/i18n/I18nProvider';
import styles from './SocModals.module.css';

interface FimDiffData {
	path: string;
	status: 'modified' | 'added' | 'deleted' | 'unchanged' | 'not_found';
	originalContent: string;
	currentContent: string;
	diff: string;
	error?: string;
}

interface FimDiffModalProps {
	filePath: string;
	onClose: () => void;
}

export const FimDiffModal: React.FC<FimDiffModalProps> = ({ filePath, onClose }) => {
	const { language } = useI18n();
	const isEn = language === 'en';

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
				if (isMounted) {
					if (json.diff) {
						setData(json.diff);
					} else {
						setData({
							path: filePath,
							status: 'not_found',
							originalContent: '',
							currentContent: '',
							diff: '',
							error: json.error || 'Diff verisi alınamadı.',
						});
					}
					setLoading(false);
				}
			})
			.catch((err) => {
				if (isMounted) {
					setData({
						path: filePath,
						status: 'not_found',
						originalContent: '',
						currentContent: '',
						diff: '',
						error: String(err),
					});
					setLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [filePath]);

	const handleCopy = () => {
		const textToCopy = data?.diff || data?.currentContent || '';
		if (!textToCopy) return;
		navigator.clipboard.writeText(textToCopy);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const renderLines = (content: string, type: 'orig' | 'curr') => {
		if (!content) {
			return (
				<div style={{ padding: '16px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
					{type === 'orig'
						? isEn ? 'No baseline (New file)' : 'Başlangıç kopyası yok (Yeni dosya)'
						: isEn ? 'File deleted on disk' : 'Diskte dosya bulunamadı (Silinmiş)'}
				</div>
			);
		}

		const lines = content.split('\n');
		return lines.map((line, idx) => (
			<div key={idx} className={styles.diffLine}>
				<span className={styles.diffLineNumber}>{idx + 1}</span>
				<span>{line || ' '}</span>
			</div>
		));
	};

	const renderUnifiedDiff = () => {
		if (!data?.diff) {
			return (
				<div style={{ padding: '16px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
					{isEn ? 'No diff hunks recorded.' : 'Herhangi bir diff farkı bulunamadı.'}
				</div>
			);
		}

		const lines = data.diff.split('\n');
		return lines.map((line, idx) => {
			let lineClass = styles.diffLine;
			if (line.startsWith('+') && !line.startsWith('+++')) {
				lineClass = `${styles.diffLine} ${styles.diffLineAdd}`;
			} else if (line.startsWith('-') && !line.startsWith('---')) {
				lineClass = `${styles.diffLine} ${styles.diffLineDel}`;
			}

			return (
				<div key={idx} className={lineClass}>
					<span className={styles.diffLineNumber}>{idx + 1}</span>
					<span>{line || ' '}</span>
				</div>
			);
		});
	};

	return (
		<div className={styles.backdrop} onClick={onClose}>
			<div className={styles.diffModal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.modalHeader}>
					<div className={styles.modalHeaderTitle}>
						<GitCompare size={15} style={{ color: 'var(--accent)' }} />
						<span>{isEn ? 'FIM Visual Diff Inspection' : 'FIM Görsel Değişiklik İncelemesi'}</span>
						<span
							style={{
								fontSize: '11px',
								fontWeight: 600,
								padding: '2px 8px',
								borderRadius: '4px',
								background:
									data?.status === 'modified'
										? 'rgba(255, 149, 0, 0.15)'
										: data?.status === 'added'
										? 'rgba(52, 199, 89, 0.15)'
										: 'rgba(255, 59, 48, 0.15)',
								color:
									data?.status === 'modified'
										? '#b25000'
										: data?.status === 'added'
										? '#248a3d'
										: '#d70015',
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
							title={isEn ? 'Toggle view mode' : 'Görünüm modunu değiştir'}
						>
							{viewMode === 'split' ? <FileText size={13} /> : <Columns size={13} />}
							<span>{viewMode === 'split' ? (isEn ? 'Unified' : 'Birleşik') : (isEn ? 'Split' : 'Yan Yana')}</span>
						</button>

						<button
							type="button"
							className={styles.btn}
							onClick={handleCopy}
							disabled={loading || !data}
							title={isEn ? 'Copy diff' : 'Farkı kopyala'}
						>
							{copied ? <Check size={13} style={{ color: '#248a3d' }} /> : <Copy size={13} />}
							<span>{copied ? (isEn ? 'Copied' : 'Kopyalandı') : (isEn ? 'Copy' : 'Kopyala')}</span>
						</button>

						<button type="button" className={styles.closeBtn} onClick={onClose} aria-label={isEn ? 'Close' : 'Kapat'}>
							<X size={15} />
						</button>
					</div>
				</div>

				<div style={{ padding: '8px 18px', background: 'var(--fill-soft)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontFamily: 'monospace' }}>
					<FileCode size={13} style={{ color: 'var(--text-secondary)' }} />
					<span style={{ fontWeight: 600 }}>{filePath}</span>
				</div>

				<div className={styles.modalBody} style={{ flex: 1, minHeight: 0, padding: '14px' }}>
					{loading ? (
						<div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
							<span>{isEn ? 'Analyzing git & disk hunks...' : 'Git ve disk blokları karşılaştırılıyor...'}</span>
						</div>
					) : data?.error ? (
						<div style={{ padding: '16px', background: 'rgba(255, 59, 48, 0.1)', color: '#d70015', borderRadius: '8px', fontSize: '12px' }}>
							{data.error}
						</div>
					) : viewMode === 'split' ? (
						<div className={styles.diffPanes}>
							<div className={styles.diffPane}>
								<div className={styles.diffPaneHeader}>
									<span>{isEn ? 'Git Baseline (HEAD)' : 'Git Başlangıç (HEAD)'}</span>
								</div>
								<div className={styles.diffCodeContainer}>
									{renderLines(data?.originalContent || '', 'orig')}
								</div>
							</div>

							<div className={styles.diffPane}>
								<div className={styles.diffPaneHeader}>
									<span>{isEn ? 'Current Disk Content' : 'Mevcut Disk İçeriği'}</span>
								</div>
								<div className={styles.diffCodeContainer}>
									{renderLines(data?.currentContent || '', 'curr')}
								</div>
							</div>
						</div>
					) : (
						<div className={styles.diffPane} style={{ flex: 1, minHeight: 0 }}>
							<div className={styles.diffPaneHeader}>
								<span>{isEn ? 'Unified Git Patch / Diff' : 'Birleşik Git Yaması / Fark'}</span>
							</div>
							<div className={styles.diffCodeContainer}>
								{renderUnifiedDiff()}
							</div>
						</div>
					)}
				</div>

				<div className={styles.modalFooter}>
					<button type="button" className={styles.btn} onClick={onClose}>
						{isEn ? 'Close' : 'Kapat'}
					</button>
				</div>
			</div>
		</div>
	);
};
export default FimDiffModal;
