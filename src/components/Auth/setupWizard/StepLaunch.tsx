import React from 'react';
import styles from '../VsCodeSetup.module.css';
import { ARCHETYPE_PRESETS, type OrganizationArchetype } from '@/lib/archetypes';
import type { Language } from '@/lib/i18n';

interface StepLaunchProps {
	language: Language;
	launching: boolean;
	archetype: OrganizationArchetype;
	studioName: string;
	communityName: string;
	domain: string;
	name: string;
	surname: string;
	email: string;
	smtpHost: string;
	smtpPort: string;
	dbConnected: boolean;
}

export function StepLaunch({
	language,
	launching,
	archetype,
	studioName,
	communityName,
	domain,
	name,
	surname,
	email,
	smtpHost,
	smtpPort,
	dbConnected,
}: StepLaunchProps) {
	const selectedPreset = ARCHETYPE_PRESETS[archetype];

	return (
		<div className={styles.selectionBody}>
			{launching ? (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '16px',
						padding: '48px 16px',
						textAlign: 'center',
					}}
				>
					<div className="boot-splash__spinner" style={{ width: '40px', height: '40px' }} />
					<div>
						<h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 6px 0' }}>
							Provisioning Orbit Community OS...
						</h3>
						<p style={{ fontSize: '12.5px', color: '#888888', margin: 0 }}>
							Migrating PostgreSQL schemas, initializing system roles, and creating administrator session.
						</p>
					</div>
				</div>
			) : (
				<div className={styles.card}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
							<span style={{ color: '#888888' }}>Organization Archetype</span>
							<span style={{ fontWeight: 600, color: '#9cdcfe' }}>
								{selectedPreset.name[language] ?? selectedPreset.name.en}
							</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
							<span style={{ color: '#888888' }}>Studio / {selectedPreset.parentEntityLabel[language] ?? selectedPreset.parentEntityLabel.en}</span>
							<span style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>{studioName}</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
							<span style={{ color: '#888888' }}>Community Workspace</span>
							<span style={{ fontWeight: 600, color: '#ffffff' }}>{communityName}</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
							<span style={{ color: '#888888' }}>Primary Domain</span>
							<span style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>{domain}</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
							<span style={{ color: '#888888' }}>Root Administrator</span>
							<span style={{ fontWeight: 600, color: '#ffffff' }}>
								{name} {surname} ({email})
							</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333333' }}>
							<span style={{ color: '#888888' }}>SMTP Email Relay</span>
							<span style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>
								{smtpHost ? `${smtpHost}:${smtpPort}` : 'Disabled (configure later)'}
							</span>
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between' }}>
							<span style={{ color: '#888888' }}>Database Engine</span>
							<span style={{ fontWeight: 600, color: '#4ec9b0', fontFamily: 'monospace' }}>
								{dbConnected ? 'PostgreSQL Verified ✓' : 'Direct Connection'}
							</span>
						</div>
					</div>
				</div>
			)}

			<div className={styles.card} style={{ marginTop: '12px' }}>
				<h3 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
					Provisioned workspace defaults ({selectedPreset.name[language] ?? selectedPreset.name.en})
				</h3>
				<p style={{ margin: '0 0 12px', fontSize: '11.5px', lineHeight: 1.5, color: '#9d9d9d' }}>
					Everything below is seeded from the selected organization archetype during initialization and can be changed later in Settings.
				</p>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: '11.5px' }}>
					<div>
						<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>Access roles</strong>
						<span style={{ color: '#9d9d9d' }}>Admin · Management Board · Member · Alumni</span>
					</div>
					<div>
						<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>
							{selectedPreset.unitLabel[language] ?? selectedPreset.unitLabel.en} categories
						</strong>
						<span style={{ color: '#9d9d9d' }}>
							{selectedPreset.defaultUnitCategories.map((c) => c.labelEn).join(' · ')}
						</span>
					</div>
					<div>
						<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>Registration form</strong>
						<span style={{ color: '#9d9d9d' }}>
							{selectedPreset.defaultTracks.length} {(selectedPreset.trackLabel[language] ?? selectedPreset.trackLabel.en).toLowerCase()} options ·{' '}
							{selectedPreset.defaultLevels.length} {(selectedPreset.levelLabel[language] ?? selectedPreset.levelLabel.en).toLowerCase()} tiers
						</span>
					</div>
					<div>
						<strong style={{ display: 'block', color: '#ffffff', marginBottom: '2px' }}>Legal & branding</strong>
						<span style={{ color: '#9d9d9d' }}>3 agreements · identity · favicon/PWA icon pipeline</span>
					</div>
				</div>
				<div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #333333', fontSize: '11.5px', lineHeight: 1.55, color: '#9d9d9d' }}>
					<strong style={{ color: '#ffffff' }}>After launch:</strong> sign in with the root administrator and enroll two-factor
					authentication. Then review Settings → Identity & Branding, Registration & Member Form, Teams and Roles & Permissions
					before inviting members.
				</div>
			</div>
		</div>
	);
}
