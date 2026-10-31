'use client';

import React from 'react';
import { Check, FileText, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';

export interface LegalDocumentContent {
	id: string;
	docType: string;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
}

interface LegalDocumentModalProps {
	document: LegalDocumentContent | null;
	onClose: () => void;
	onAccept?: () => void;
}

/** Minimal safe Markdown rendering for legal copy: headings, lists and paragraphs. */
function LegalBody({ text }: { text: string }) {
	const blocks = text.split(/\n{2,}/);
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			{blocks.map((block, index) => {
				const trimmed = block.trim();
				if (!trimmed) return null;
				if (trimmed.startsWith('## ')) {
					return (
						<h4
							key={index}
							style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary, #fafafa)' }}
						>
							{trimmed.slice(3)}
						</h4>
					);
				}
				if (trimmed.startsWith('# ')) {
					return (
						<h3
							key={index}
							style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #fafafa)' }}
						>
							{trimmed.slice(2)}
						</h3>
					);
				}
				if (trimmed.startsWith('- ')) {
					return (
						<ul key={index} style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
							{trimmed.split('\n').map((line, lineIndex) => (
								<li key={lineIndex}>{line.replace(/^-\s*/, '')}</li>
							))}
						</ul>
					);
				}
				return (
					<p key={index} style={{ margin: 0 }}>
						{trimmed}
					</p>
				);
			})}
		</div>
	);
}

export function LegalDocumentModal({ document, onClose, onAccept }: LegalDocumentModalProps) {
	const { language } = useI18n();
	if (!document) return null;

	const isTr = language === 'tr';
	const title = isTr ? document.titleTr : document.titleEn;
	const body = isTr ? document.bodyTr : document.bodyEn;

	return (
		<div
			role="dialog"
			aria-modal="true"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'rgba(3, 7, 18, 0.72)',
				backdropFilter: 'blur(10px)',
				padding: '16px',
			}}
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '660px',
					maxHeight: '86vh',
					background: 'rgba(15, 17, 23, 0.94)',
					border: '1px solid rgba(255,255,255,0.14)',
					borderRadius: '14px',
					color: '#e4e4e7',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: '12px',
						padding: '16px 20px',
						borderBottom: '1px solid rgba(255,255,255,0.1)',
						background: 'rgba(9, 9, 11, 0.6)',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
						<span
							style={{
								width: '32px',
								height: '32px',
								borderRadius: '8px',
								border: '1px solid rgba(255,255,255,0.14)',
								display: 'grid',
								placeItems: 'center',
								flexShrink: 0,
							}}
						>
							<FileText size={15} />
						</span>
						<div style={{ minWidth: 0 }}>
							<div style={{ fontSize: '10.5px', letterSpacing: '0.08em', opacity: 0.55, textTransform: 'uppercase' }}>
								{document.docType}
							</div>
							<h3 style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700, color: '#fafafa' }}>
								{title}
							</h3>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label={isTr ? 'Kapat' : 'Close'}
						style={{
							width: '30px',
							height: '30px',
							borderRadius: '7px',
							border: '1px solid rgba(255,255,255,0.14)',
							background: 'transparent',
							color: 'inherit',
							display: 'grid',
							placeItems: 'center',
							cursor: 'pointer',
							flexShrink: 0,
						}}
					>
						<X size={14} />
					</button>
				</div>

				<div style={{ padding: '20px', overflowY: 'auto', fontSize: '12.8px', lineHeight: 1.7 }}>
					<LegalBody text={body} />
				</div>

				<div
					style={{
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '8px',
						padding: '13px 20px',
						borderTop: '1px solid rgba(255,255,255,0.1)',
						background: 'rgba(9, 9, 11, 0.6)',
					}}
				>
					<button
						type="button"
						onClick={onClose}
						style={{
							minHeight: '36px',
							padding: '0 14px',
							borderRadius: '7px',
							border: '1px solid rgba(255,255,255,0.14)',
							background: 'transparent',
							color: 'inherit',
							fontSize: '12px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						{isTr ? 'Kapat' : 'Close'}
					</button>
					{onAccept && (
						<button
							type="button"
							onClick={onAccept}
							style={{
								minHeight: '36px',
								padding: '0 16px',
								borderRadius: '7px',
								border: '1px solid #fafafa',
								background: '#fafafa',
								color: '#09090b',
								fontSize: '12px',
								fontWeight: 700,
								cursor: 'pointer',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
							}}
						>
							<Check size={13} />
							{isTr ? 'Okudum ve kabul ediyorum' : 'I have read and accept'}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
