import React from 'react';
import { Building2, CheckCircle2, Globe, Sparkles } from 'lucide-react';
import styles from '../VsCodeSetup.module.css';
import {
	ARCHETYPE_PRESETS,
	ORGANIZATION_ARCHETYPES,
	type OrganizationArchetype,
} from '@/lib/archetypes';
import type { Language } from '@/lib/i18n';
import { ProxyAssistantCard } from './ProxyAssistantCard';

interface StepIdentityProps {
	language: Language;
	archetype: OrganizationArchetype;
	onArchetypeChange: (value: OrganizationArchetype) => void;
	studioName: string;
	onStudioNameChange: (value: string) => void;
	communityName: string;
	onCommunityNameChange: (value: string) => void;
	domain: string;
	onDomainChange: (value: string) => void;
}

export function StepIdentity({
	language,
	archetype,
	onArchetypeChange,
	studioName,
	onStudioNameChange,
	communityName,
	onCommunityNameChange,
	domain,
	onDomainChange,
}: StepIdentityProps) {
	const selectedPreset = ARCHETYPE_PRESETS[archetype];

	return (
		<div className={styles.selectionBody}>
			<div className={styles.formGroup}>
				<label className={styles.label}>Organization Archetype</label>
				<p className={styles.helperText} style={{ marginTop: 0, marginBottom: '8px' }}>
					Select an archetype to pre-configure member tracks, seniority tiers, working-group categories, and governance terminology.
				</p>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
						gap: '10px',
					}}
				>
					{ORGANIZATION_ARCHETYPES.map((archId) => {
						const preset = ARCHETYPE_PRESETS[archId];
						const isSelected = archetype === archId;
						const localizedName = preset.name[language] ?? preset.name.en;
						const localizedDesc = preset.description[language] ?? preset.description.en;
						const localizedUnit = preset.unitLabel[language] ?? preset.unitLabel.en;
						const localizedTrack = preset.trackLabel[language] ?? preset.trackLabel.en;

						return (
							<button
								key={archId}
								type="button"
								onClick={() => onArchetypeChange(archId)}
								style={{
									textAlign: 'left',
									padding: '12px 14px',
									borderRadius: '6px',
									border: isSelected ? '1px solid #0078d4' : '1px solid #333333',
									backgroundColor: isSelected ? 'color-mix(in srgb, var(--ink-vs-accent) 12%, transparent)' : '#1e1e1e',
									color: '#ffffff',
									cursor: 'pointer',
									display: 'flex',
									flexDirection: 'column',
									gap: '6px',
									transition: 'border-color 0.15s ease, background-color 0.15s ease',
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
									<span style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
										{localizedName}
									</span>
									{isSelected && <CheckCircle2 size={15} style={{ color: '#4ec9b0', flexShrink: 0 }} />}
								</div>
								<span style={{ fontSize: '11.5px', color: '#a1a1aa', lineHeight: 1.45 }}>
									{localizedDesc}
								</span>
								<div
									style={{
										display: 'flex',
										flexWrap: 'wrap',
										gap: '4px',
										marginTop: '4px',
										fontSize: '10.5px',
										color: '#9cdcfe',
										fontFamily: 'monospace',
									}}
								>
									<span>{localizedUnit}</span>
									<span>·</span>
									<span>{localizedTrack}</span>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			<div className={styles.formRow}>
				<div className={styles.formGroup}>
					<label className={styles.label}>
						Studio / {selectedPreset.parentEntityLabel[language] ?? selectedPreset.parentEntityLabel.en}
					</label>
					<div className={styles.inputWrap}>
						<Building2 size={15} className={styles.inputIcon} />
						<input
							type="text"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={studioName}
							onChange={(e) => onStudioNameChange(e.target.value)}
							placeholder={selectedPreset.parentEntityLabel[language] ?? selectedPreset.parentEntityLabel.en}
							required
						/>
					</div>
					<p className={styles.helperText}>
						The engineering studio or {(selectedPreset.parentEntityLabel[language] ?? selectedPreset.parentEntityLabel.en).toLowerCase()} maintaining this deployment.
					</p>
				</div>

				<div className={styles.formGroup}>
					<label className={styles.label}>
						{selectedPreset.name[language] ?? selectedPreset.name.en} Workspace Name
					</label>
					<div className={styles.inputWrap}>
						<Sparkles size={15} className={styles.inputIcon} />
						<input
							type="text"
							className={`${styles.input} ${styles.inputWithIcon}`}
							value={communityName}
							onChange={(e) => onCommunityNameChange(e.target.value)}
							placeholder="Orbit Community"
							required
						/>
					</div>
					<p className={styles.helperText}>The organization title presented to members, governance records, and documents.</p>
				</div>
			</div>

			<div className={styles.formGroup}>
				<label className={styles.label}>Primary Domain (FQDN)</label>
				<div className={styles.inputWrap}>
					<Globe size={15} className={styles.inputIcon} />
					<input
						type="text"
						className={`${styles.input} ${styles.inputWithIcon}`}
						value={domain}
						onChange={(e) => onDomainChange(e.target.value)}
						placeholder="orbit.example.com"
						required
					/>
				</div>
				<p className={styles.helperText}>The public domain or local hostname where members will access Orbit.</p>
			</div>

			<ProxyAssistantCard domain={domain} />
		</div>
	);
}
