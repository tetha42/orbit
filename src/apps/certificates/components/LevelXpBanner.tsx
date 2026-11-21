'use client';

import React from 'react';
import { Medal } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface LevelXpBannerProps {
	userLevel: number;
	userXP: number;
	nextLevelXP: number;
	progressPercent: number;
}

export function LevelXpBanner({
	userLevel,
	userXP,
	nextLevelXP,
	progressPercent,
}: LevelXpBannerProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))',
				border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
				borderRadius: '16px',
				padding: '20px 24px',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				flexWrap: 'wrap',
				gap: '16px',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
				<div
					style={{
						width: '56px',
						height: '56px',
						borderRadius: '16px',
						background: 'linear-gradient(135deg, var(--accent), #0056b3)',
						display: 'grid',
						placeItems: 'center',
						boxShadow: '0 8px 20px color-mix(in srgb, var(--accent) 35%, transparent)',
					}}
				>
					<Medal size={30} color="#fff" />
				</div>

				<div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
							{t('certsLevel')} {userLevel} • {t('certsExplorer')}
						</h3>
						<span
							style={{
								fontSize: '11px',
								fontWeight: 700,
								padding: '2px 8px',
								borderRadius: '6px',
								background: 'color-mix(in srgb, var(--warning) 20%, transparent)',
								color: 'var(--warning)',
							}}
						>
							{userXP} XP
						</span>
					</div>
					<p style={{ margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.75 }}>
						{t('crtXpHint')}
					</p>
				</div>
			</div>

			<div style={{ minWidth: '220px' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
					<span>{t('certsNextLevel')} (Lvl {userLevel + 1})</span>
					<span>{userXP} / {nextLevelXP} XP</span>
				</div>
				<div
					style={{
						height: '8px',
						borderRadius: '4px',
						background: 'rgba(255, 255, 255, 0.1)',
						overflow: 'hidden',
					}}
				>
					<div
						style={{
							height: '100%',
							width: `${progressPercent}%`,
							background: 'linear-gradient(90deg, var(--warning), var(--accent))',
							borderRadius: '4px',
						}}
					/>
				</div>
			</div>
		</div>
	);
}
