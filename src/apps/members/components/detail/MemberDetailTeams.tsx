'use client';

import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { MemberRecord } from '../../types';

interface MemberDetailTeamsProps {
	member: MemberRecord;
}

export function MemberDetailTeams({ member }: MemberDetailTeamsProps) {
	const { t } = useI18n();

	const memberTeams = useMemo(() => {
		const raw = member.teams ?? [];
		const seen = new Set<string>();
		return raw.filter((team) => {
			if (!team?.id || seen.has(team.id)) return false;
			seen.add(team.id);
			return true;
		});
	}, [member.teams]);

	return (
		<div
			style={{
				padding: '10px 12px',
				borderRadius: '10px',
				background: 'rgba(255, 255, 255, 0.03)',
				border: '1px solid var(--window-border)',
				display: 'flex',
				flexDirection: 'column',
				gap: '8px',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', opacity: 0.7, fontWeight: 600 }}>
				<Users size={13} />
				<span>{t('membersTeamProjectLabel')}</span>
			</div>

			{memberTeams.length > 0 ? (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
					{memberTeams.map((team) => (
						<div
							key={team.id}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: '8px',
								padding: '6px 9px',
								borderRadius: '8px',
								background: 'rgba(255, 255, 255, 0.04)',
								fontSize: '12px',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
								<span style={{ fontWeight: 600 }}>{team.name}</span>
								{team.isLeader && (
									<span
										style={{
											fontSize: '10.5px',
											fontWeight: 700,
											padding: '1px 6px',
											borderRadius: '999px',
											background: 'color-mix(in srgb, var(--warning) 16%, transparent)',
											color: 'var(--warning)',
										}}
									>
										{t('teamRoleCaptain')}
									</span>
								)}
							</div>
							<div style={{ fontSize: '11px', opacity: 0.65, flexShrink: 0 }}>
								{[team.role, team.category].filter(Boolean).join(' · ')}
							</div>
						</div>
					))}
				</div>
			) : member.teamName ? (
				<div style={{ fontSize: '12.5px', fontWeight: 500 }}>{member.teamName}</div>
			) : (
				<div style={{ fontSize: '12px', opacity: 0.55 }}>{t('membersNotAssigned')}</div>
			)}
		</div>
	);
}
