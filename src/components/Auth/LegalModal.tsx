'use client';

import React, { useState } from 'react';
import { X, Shield, FileText, Cookie, Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { LegalModalContent } from './legal/LegalModalContent';

export type LegalTab = 'terms' | 'privacy' | 'cookies';

interface LegalModalProps {
	isOpen: boolean;
	initialTab?: LegalTab;
	onClose: () => void;
	onAccept?: () => void;
}

export function LegalModal({ isOpen, initialTab = 'terms', onClose, onAccept }: LegalModalProps) {
	const { t } = useI18n();
	const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

	React.useEffect(() => {
		if (isOpen && initialTab) {
			setActiveTab(initialTab);
		}
	}, [isOpen, initialTab]);

	if (!isOpen) return null;

	const tabs: Array<{ id: LegalTab; label: string; icon: React.ReactNode }> = [
		{ id: 'terms', label: t('legalTabTerms', 'Terms of Service'), icon: <FileText size={14} /> },
		{ id: 'privacy', label: t('legalTabPrivacy', 'Privacy Policy (GDPR)'), icon: <Shield size={14} /> },
		{ id: 'cookies', label: t('legalTabCookies', 'Cookie & Session Policy'), icon: <Cookie size={14} /> },
	];

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
				background: 'color-mix(in srgb, var(--ink-bg) 85%, transparent)',
				padding: '16px',
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '640px',
					maxHeight: '85vh',
					background: '#111113',
					border: '1px solid #27272a',
					borderRadius: '10px',
					color: '#fafafa',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '16px 20px',
						borderBottom: '1px solid #27272a',
						background: '#09090b',
					}}
				>
					<div>
						<div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#a1a1aa', letterSpacing: '0.08em' }}>
							ORBIT // TETHA42 • LEGAL & COMPLIANCE
						</div>
						<h3 style={{ fontSize: '16px', fontWeight: 700, margin: '4px 0 0', color: '#fafafa' }}>
							{t('legalModalHeaderTitle', 'Global Legal Standards & Data Protection')}
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label={t('close', 'Close')}
						style={{
							width: '32px',
							height: '32px',
							borderRadius: '6px',
							border: '1px solid #27272a',
							background: '#111113',
							color: '#a1a1aa',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							cursor: 'pointer',
						}}
					>
						<X size={16} />
					</button>
				</div>

				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(3, 1fr)',
						gap: '6px',
						padding: '10px 20px',
						background: '#09090b',
						borderBottom: '1px solid #27272a',
					}}
				>
					{tabs.map((tab) => {
						const active = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '6px',
									padding: '8px 10px',
									borderRadius: '6px',
									border: active ? '1px solid #fafafa' : '1px solid #27272a',
									background: active ? '#fafafa' : '#111113',
									color: active ? '#09090b' : '#a1a1aa',
									fontSize: '12px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								{tab.icon}
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>

				<LegalModalContent activeTab={activeTab} />

				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'flex-end',
						gap: '10px',
						padding: '14px 20px',
						borderTop: '1px solid #27272a',
						background: '#09090b',
					}}
				>
					<button
						type="button"
						onClick={onClose}
						style={{
							minHeight: '40px',
							padding: '0 16px',
							borderRadius: '6px',
							border: '1px solid #27272a',
							background: '#111113',
							color: '#a1a1aa',
							fontSize: '13px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						{t('close', 'Close')}
					</button>
					{onAccept && (
						<button
							type="button"
							onClick={onAccept}
							style={{
								minHeight: '40px',
								padding: '0 18px',
								borderRadius: '6px',
								border: '1px solid #fafafa',
								background: '#fafafa',
								color: '#09090b',
								fontSize: '13px',
								fontWeight: 700,
								cursor: 'pointer',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
							}}
						>
							<Check size={15} />
							<span>{t('legalModalAcceptBtn', 'I Acknowledge & Accept')}</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
