'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { LegalTab } from '../LegalModal';

export function LegalModalContent({ activeTab }: { activeTab: LegalTab }) {
	const { t } = useI18n();

	return (
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
							'Orbit Community OS ("the Platform") is a self-hosted digital workspace engineered by ' +
								'tetha42 for engineering teams, open-source collectives, and research communities.'
						)}
					</p>
					<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
						{t('legalTermsH2', '2. Acceptable Use & Account Security')}
					</h4>
					<p style={{ margin: 0 }}>
						{t(
							'legalTermsP2',
							'Members are responsible for safeguarding their credentials (passwords, TOTP authenticators, ' +
								'and WebAuthn passkeys) and maintaining constructive conduct across all shared workspaces. ' +
								'Automated scraping, unauthorized probing, or attempts to compromise system integrity are ' +
								'actively mitigated by the autonomous SoC and WAF engine.'
						)}
					</p>
					<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
						{t('legalTermsH3', '3. Intellectual Property & Liability')}
					</h4>
					<p style={{ margin: 0 }}>
						{t(
							'legalTermsP3',
							'Projects, documents, and technical artifacts published within the workspace remain subject to ' +
								'the licenses designated by their respective authors and community governance. ' +
								'The Platform is provided "AS is" without warranty of any kind.'
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
							'Orbit Community OS operates under strict Data Minimization and Privacy-by-Design principles ' +
								'aligned with GDPR and global privacy regulations. Only data strictly required for identity ' +
								'verification, role-based access control, and workspace collaboration (name, email, ' +
								'member handle, track, and experience level) is processed.'
						)}
					</p>
					<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
						{t('legalPrivacyH2', '2. Cryptographic Security & Self-Hosted Sovereignty')}
					</h4>
					<p style={{ margin: 0 }}>
						{t(
							'legalPrivacyP2',
							'Passwords are hashed using Bcrypt (cost factor 12), TOTP secrets are encrypted at rest ' +
								'with AES-256-GCM, and all records reside exclusively within your self-hosted PostgreSQL ' +
								'instance. Zero personal data is sold, shared with data brokers, or transmitted externally.'
						)}
					</p>
					<h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fafafa', margin: 0 }}>
						{t('legalPrivacyH3', '3. Your Rights (Access, Erasure & Portability)')}
					</h4>
					<p style={{ margin: 0 }}>
						{t(
							'legalPrivacyP3',
							'Every member retains the right to inspect their stored profile data, rectify inaccuracies, ' +
								'export their records in machine-readable formats, and request permanent account erasure ' +
								'("Right to be Forgotten") through the workspace administrators.'
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
							'Orbit Community OS uses strictly necessary, cryptographically signed first-party HttpOnly ' +
								'session cookies (SameSite=Lax) solely to maintain authenticated sessions and CSRF defense.'
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
	);
}
