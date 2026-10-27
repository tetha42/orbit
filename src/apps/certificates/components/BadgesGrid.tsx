'use client';

import React from 'react';
import { Award, Calendar, CheckSquare, Crown, FolderGit2, Lock, Rocket, Star, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { rozetler, type Rozet } from '@/lib/badges';
import type { UserSummary } from '@/db';

const ICONS: Record<Rozet['ikon'], React.ComponentType<{ size?: number; color?: string }>> = {
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
	const { data } = useJsonResource<{ user: { xp: number }; ozet: UserSummary }>('/api/profile');
	if (!data) return null;
	const list = rozetler({
		xp: Number(data.user.xp) || 0,
		takim: data.ozet.takimlar.length,
		kaptan: data.ozet.takimlar.some((tm) => tm.kaptanMi),
		katilinanEtkinlik: data.ozet.katilinanEtkinlik,
		tamamlananGorev: data.ozet.tamamlananGorev,
		sertifika: data.ozet.sertifika,
		proje: data.ozet.proje,
	});
	const earned = list.filter((r) => r.kazanildi).length;
	return (
		<div>
			<h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px 0' }}>
				{t('bdgTitle')} <span style={{ opacity: 0.55, fontWeight: 600 }}>{earned}/{list.length}</span>
			</h3>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
				{list.map((r) => {
					const Icon = ICONS[r.ikon];
					return (
						<div
							key={r.id}
							data-badge={r.id}
							data-earned={r.kazanildi ? 'yes' : 'no'}
							title={t(r.aciklama)}
							style={{
								display: 'flex',
								gap: 12,
								alignItems: 'center',
								padding: 12,
								borderRadius: 12,
								border: `1px solid ${r.kazanildi ? `${r.renk}66` : 'var(--card-border)'}`,
								background: r.kazanildi ? `color-mix(in srgb, ${r.renk} 10%, var(--card-bg))` : 'var(--card-bg)',
								opacity: r.kazanildi ? 1 : 0.75,
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
									background: r.kazanildi ? r.renk : 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
									color: r.kazanildi ? '#fff' : 'var(--text-secondary)',
								}}
							>
								{r.kazanildi ? <Icon size={19} /> : <Lock size={16} />}
							</span>
							<div style={{ minWidth: 0, flex: 1 }}>
								<div style={{ fontSize: 13, fontWeight: 700 }}>{t(r.ad)}</div>
								<div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35 }}>{t(r.aciklama)}</div>
								{!r.kazanildi && (
									<div style={{ marginTop: 5, height: 4, borderRadius: 2, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', overflow: 'hidden' }}>
										<div style={{ height: '100%', width: `${(r.deger / r.hedef) * 100}%`, background: r.renk }} />
									</div>
								)}
							</div>
							{!r.kazanildi && (
								<span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
									{r.deger}/{r.hedef}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
