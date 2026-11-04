'use client';

import React from 'react';
import { Award, Calendar, CheckSquare, Crown, FolderGit2, Lock, Rocket, Star, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { badges, type Badge } from '@/lib/badges';
import type { UserSummary } from '@/db';

const ICONS: Record<Badge['icon'], React.ComponentType<{ size?: number; color?: string }>> = {
	rocket: Rocket,
	users: Users,
	crown: Crown,
	calendar: Calendar,
	check: CheckSquare,
	award: Award,
	folder: FolderGit2,
	star: Star,
};

/** Badges earned from the member's real record (`/api/profile`), with progress towards the rest. */
export function BadgesGrid() {
	const { t } = useI18n();
	const { data } = useJsonResource<{ user: { xp: number }; summary: UserSummary }>('/api/profile');
	if (!data) return null;
	const list = badges({
		xp: Number(data.user.xp) || 0,
		team: data.summary.teams.length,
		captain: data.summary.teams.some((tm) => tm.captainMi),
		attendedEvent: data.summary.attendedEvent,
		completedTask: data.summary.completedTask,
		certificate: data.summary.certificate,
		project: data.summary.project,
	});
	const earned = list.filter((r) => r.earned).length;
	return (
		<div>
			<h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px 0' }}>
				{t('bdgTitle')} <span style={{ opacity: 0.55, fontWeight: 600 }}>{earned}/{list.length}</span>
			</h3>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
				{list.map((r) => {
					const Icon = ICONS[r.icon];
					return (
						<div
							key={r.id}
							data-badge={r.id}
							data-earned={r.earned ? 'yes' : 'no'}
							title={t(r.description)}
							style={{
								display: 'flex',
								gap: 12,
								alignItems: 'center',
								padding: 12,
								borderRadius: 12,
								border: `1px solid ${r.earned ? `${r.color}66` : 'var(--card-border)'}`,
								background: r.earned ? `color-mix(in srgb, ${r.color} 10%, var(--card-bg))` : 'var(--card-bg)',
								opacity: r.earned ? 1 : 0.75,
							}}
						>
							<span
								style={{
									width: 38,
									height: 38,
									borderRadius: 11,
									display: 'grid',
									placeItems: 'center',
									flexShrink: 0,
									background: r.earned ? r.color : 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
									color: r.earned ? '#fff' : 'var(--text-secondary)',
								}}
							>
								{r.earned ? <Icon size={19} /> : <Lock size={16} />}
							</span>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div style={{ fontSize: 13, fontWeight: 700 }}>{t(r.name)}</div>
								<div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35 }}>{t(r.description)}</div>
								{!r.earned && (
									<div style={{ marginTop: 5, height: 4, borderRadius: 2, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', overflow: 'hidden' }}>
										<div style={{ height: '100%', width: `${(r.value / r.target) * 100}%`, background: r.color }} />
									</div>
								)}
							</div>
							{!r.earned && (
								<span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
									{r.value}/{r.target}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
