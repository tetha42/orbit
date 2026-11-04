'use client';

import React, { useState } from 'react';
import { X, Shield, FileText, Cookie, Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';

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
		{
			id: 'terms',
			label: t('legalTabTerms', 'Terms of Service'),
			icon: <FileText size={14} />,
		},
		{
			id: 'privacy',
			label: t('legalTabPrivacy', 'Privacy Policy (GDPR)'),
			icon: <Shield size={14} />,
		},
		{
			id: 'cookies',
			label: t('legalTabCookies', 'Cookie & Session Policy'),
			icon: <Cookie size={14} />,
		},
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
				background: 'rgba(9, 9, 11, 0.85)',
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
				{/* Structural Monochrome Header */}
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

				{/* Tab Bar */}
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

				{/* Content Area */}
				<div
					style={{
						padding: '20px',
						overflowY: 'auto',
						fontSize: '13px',
						lineHeight: 1.65,
						color: '#d4d4d8',
						display: 'flex',
						flexDirection: 'column',
						gap: '14px',
					}}
				>
					{activeTab === 'terms' && (
						<>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalTermsH1', '1. Terms of Service & Community Guidelines')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalTermsP1',
									'Orbit Community OS ("the Platform") is a self-hosted digital workspace engineered by tetha42 for engineering teams, open-source collectives, and research communities.'
								)}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalTermsH2', '2. Acceptable Use & Account Security')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalTermsP2',
									'Members are responsible for safeguarding their credentials (passwords, TOTP authenticators, and WebAuthn passkeys) and maintaining constructive conduct across all shared workspaces. Automated scraping, unauthorized probing, or attempts to compromise system integrity are actively mitigated by the autonomous SoC and WAF engine.'
								)}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalTermsH3', '3. Intellectual Property & Liability')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalTermsP3',
									'Projects, documents, and technical artifacts published within the workspace remain subject to the licenses designated by their respective authors and community governance. The Platform is provided "AS is" without warranty of any kind.'
								)}
							</p>
						</>
					)}

					{activeTab === 'privacy' && (
						<>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalPrivacyH1', '1. GDPR & Global Data Protection Compliance')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalPrivacyP1',
									'Orbit Community OS operates under strict Data Minimization and Privacy-by-Design principles aligned with GDPR and global privacy regulations. Only data strictly required for identity verification, role-based access control, and workspace collaboration (name, email, member handle, track, and experience level) is processed.'
								)}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalPrivacyH2', '2. Cryptographic Security & Self-Hosted Sovereignty')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalPrivacyP2',
									'Passwords are hashed using Bcrypt (cost factor 12), TOTP secrets are encrypted at rest with AES-256-GCM, and all records reside exclusively within your self-hosted PostgreSQL instance. Zero personal data is sold, shared with data brokers, or transmitted to external telemetry networks.'
								)}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalPrivacyH3', '3. Your Rights (Access, Erasure & Portability)')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalPrivacyP3',
									'Every member retains the right to inspect their stored profile data, rectify inaccuracies, export their records in machine-readable formats, and request permanent account erasure ("Right to be Forgotten") through the workspace administrators.'
								)}
							</p>
						</>
					)}

					{activeTab === 'cookies' && (
						<>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalCookiesH1', '1. Strictly Necessary Session Cookies (HttpOnly)')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalCookiesP1',
									'Orbit Community OS uses strictly necessary, cryptographically signed first-party HttpOnly session cookies (SameSite=Lax) solely to maintain authenticated sessions and enforce CSRF protection.'
								)}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalCookiesH2', '2. Local Workspace Preferences')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalCookiesP2',
									'User interface preferences such AS language selection, theme mode, window geometry, and audio volume are stored locally in your browser via LocalStorage.'
								)}
							</p>
							<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
								{t('legalCookiesH3', '3. Zero Third-Party Advertising or Tracking Cookies')}
							</h4>
							<p style={{ margin: 0 }}>
								{t(
									'legalCookiesP3',
									'Orbit Community OS deploys zero third-party advertising cookies, behavioral profiling pixels, or cross-site analytics trackers.'
								)}
							</p>
						</>
					)}
				</div>

				{/* Footer */}
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
