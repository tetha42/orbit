'use client';

import React from 'react';
import { FilePen, Lock, Globe, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { NEWS_VISIBILITIES, type NewsVisibility } from '@/types/news';

interface NewsVisibilitySectionProps {
	newVisibility: NewsVisibility;
	newCategory: string;
	newIsImportant: boolean;
	onChangeVisibility: (v: NewsVisibility) => void;
	onChangeCategory: (c: string) => void;
	onChangeIsImportant: (val: boolean) => void;
}

export function getVisibilityMeta(t: (key: string) => string): Record<
	NewsVisibility,
	{ color: string; icon: React.ComponentType<{ size?: number; color?: string }>; hint: string; label: string }
> {
	return {
		draft: { color: '#8e8e93', icon: FilePen, hint: t('newsVisDraftHint'), label: t('newsVisDraft') },
		members: { color: 'var(--accent)', icon: Lock, hint: t('newsVisMembersHint'), label: t('newsVisMembers') },
		published: { color: 'var(--success)', icon: Globe, hint: t('newsVisPublicHint'), label: t('newsVisPublic') },
	};
}

export function NewsVisibilitySection({
	newVisibility,
	newCategory,
	newIsImportant,
	onChangeVisibility,
	onChangeCategory,
	onChangeIsImportant,
}: NewsVisibilitySectionProps) {
	const { t } = useI18n();
	const visibilityBadges = getVisibilityMeta(t);

	return (
		<>
			<div>
				<label
					htmlFor="news-visibility"
					style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '6px', opacity: 0.8 }}
				>
					{t('newsWhoCanSee')}
				</label>
				<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" id="news-visibility" aria-label={t('newsWhoCanSee')}>
					{NEWS_VISIBILITIES.map((value) => {
						const badge = visibilityBadges[value];
						const Icon = badge.icon;
						const active = newVisibility === value;
						return (
							<button
								key={value}
								type="button"
								role="radio"
								aria-checked={active}
								onClick={() => onChangeVisibility(value)}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '6px',
									padding: '7px 12px',
									borderRadius: '8px',
									border: active ? `1px solid ${badge.color}` : '1px solid var(--border-subtle)',
									background: active ? `color-mix(in srgb, ${badge.color} 15%, transparent)` : 'var(--fill-softer)',
									color: active ? badge.color : 'inherit',
									fontSize: '12.5px',
									fontWeight: active ? 700 : 500,
									cursor: 'pointer',
								}}
							>
								<Icon size={13} />
								{badge.label}
							</button>
						);
					})}
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
				<div>
					<label style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.8, display: 'block', marginBottom: '4px' }}>
						{t('newsCategoryLabel')}
					</label>
					<select
						value={newCategory}
						onChange={(e) => onChangeCategory(e.target.value)}
						style={{
							width: '100%',
							padding: '9px 12px',
							borderRadius: '8px',
							background: 'rgba(0, 0, 0, 0.3)',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							color: 'inherit',
							fontSize: '13px',
						}}
					>
						<option value="general">{t('newsCatGeneral')}</option>
						<option value="teknofest">{t('newsCatTeknofest')}</option>
						<option value="workshop">{t('newsCatWorkshop')}</option>
						<option value="collaboration">{t('newsCatPartner')}</option>
						<option value="official">{t('newsCatOfficial')}</option>
					</select>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
					<label
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							fontSize: '12.5px',
							fontWeight: 600,
							cursor: 'pointer',
							color: newIsImportant ? '#ff375f' : 'inherit',
						}}
					>
						<input
							type="checkbox"
							checked={newIsImportant}
							onChange={(e) => onChangeIsImportant(e.target.checked)}
							style={{ width: '16px', height: '16px' }}
						/>
						<span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
							<ShieldAlert size={14} /> {t('newsPinUrgent')}
						</span>
					</label>
				</div>
			</div>
		</>
	);
}
