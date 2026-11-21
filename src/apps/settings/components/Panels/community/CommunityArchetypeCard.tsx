'use client';

import React from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
import { resolveLocalizedText, useI18n } from '@/core/i18n';
import {
	ARCHETYPE_PRESETS,
	ORGANIZATION_ARCHETYPES,
	type OrganizationArchetype,
} from '@/lib/archetypes';
import { communityCardStyle, communitySectionTitleStyle } from './styles';

interface CommunityArchetypeCardProps {
	archetype: OrganizationArchetype;
	disabled?: boolean;
	onSelectArchetype: (next: OrganizationArchetype) => void;
}

export function CommunityArchetypeCard({
	archetype,
	disabled = false,
	onSelectArchetype,
}: CommunityArchetypeCardProps) {
	const { t, language } = useI18n();

	return (
		<div style={communityCardStyle}>
			<div>
				<h3 style={communitySectionTitleStyle}>
					<Layers size={16} color="var(--accent)" />
					{t('organizationArchetypeTitle', 'Organization Archetype')}
				</h3>
				<p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: 1.45 }}>
					{t(
						'organizationArchetypeDesc',
						'Defines the structural vocabulary of your workspace across member tracks, seniority tiers, working-group categories, and governance records.',
					)}
				</p>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
					gap: '10px',
				}}
			>
				{ORGANIZATION_ARCHETYPES.map((archId) => {
					const preset = ARCHETYPE_PRESETS[archId];
					const selected = archetype === archId;
					const name = resolveLocalizedText(preset.name, language);
					const description = resolveLocalizedText(preset.description, language);
					const unitLabel = resolveLocalizedText(preset.unitLabel, language);
					const trackLabel = resolveLocalizedText(preset.trackLabel, language);

					return (
						<button
							key={archId}
							type="button"
							disabled={disabled}
							onClick={() => onSelectArchetype(archId)}
							style={{
								textAlign: 'left',
								padding: '12px',
								borderRadius: '10px',
								border: selected ? '1.5px solid var(--accent)' : '1px solid var(--window-border)',
								background: selected
									? 'color-mix(in srgb, var(--accent) 12%, transparent)'
									: 'rgba(255,255,255,0.025)',
								color: 'inherit',
								cursor: disabled ? 'not-allowed' : 'pointer',
								display: 'flex',
								flexDirection: 'column',
								gap: '6px',
								transition: 'border-color 140ms ease, background 140ms ease',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
								<span style={{ fontSize: '13px', fontWeight: 600 }}>{name}</span>
								{selected && <CheckCircle2 size={15} color="var(--accent)" />}
							</div>
							<p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
								{description}
							</p>
							<div
								style={{
									display: 'flex',
									gap: '6px',
									flexWrap: 'wrap',
									marginTop: '2px',
									fontSize: '10.5px',
									color: 'var(--text-secondary)',
								}}
							>
								<span
									style={{
										padding: '2px 7px',
										borderRadius: '6px',
										background: 'rgba(255,255,255,0.06)',
									}}
								>
									{unitLabel}
								</span>
								<span
									style={{
										padding: '2px 7px',
										borderRadius: '6px',
										background: 'rgba(255,255,255,0.06)',
									}}
								>
									{trackLabel}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
