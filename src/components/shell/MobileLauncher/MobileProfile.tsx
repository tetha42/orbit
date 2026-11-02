'use client';

import { LogOut, Settings } from 'lucide-react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { seviye } from '@/lib/profile';
import { RoleBadge, roleGradient } from '@/core/ui/RoleBadge';
import { BadgesGrid } from '@/apps/certificates/components/BadgesGrid';
import type { AppID } from '@/types/workspace';

const BUTTON = {
	flex: 1,
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '8px',
	minHeight: '46px',
	borderRadius: '14px',
	border: '1px solid rgba(255, 255, 255, 0.14)',
	background: 'rgba(255, 255, 255, 0.07)',
	color: '#fff',
	fontSize: '13.5px',
	fontWeight: 600,
	cursor: 'pointer',
} as const;

/** The member's card: identity, role, level, badges — and the way to Settings and out. */
export function MobileProfile({ onOpenApp }: { onOpenApp: (appId: AppID) => void }) {
	const { currentUser, logout } = useSession();
	const { t } = useI18n();
	if (!currentUser) return null;
	const level = seviye(currentUser.xp || 0);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div
				data-mobile-profile
				style={{
					background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
					border: '1px solid rgba(255, 255, 255, 0.12)',
					borderRadius: '18px',
					padding: '18px',
					display: 'flex',
					flexDirection: 'column',
					gap: '14px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
					<div
						style={{
							width: '56px',
							height: '56px',
							borderRadius: '50%',
							background: roleGradient(currentUser.rolBilgi?.renk),
							display: 'grid',
							placeItems: 'center',
							fontWeight: 700,
							fontSize: '18px',
							flexShrink: 0,
						}}
					>
						{`${currentUser.ad[0] ?? ''}${currentUser.soyad[0] ?? ''}`}
					</div>
					<div style={{ minWidth: 0 }}>
						<div style={{ fontSize: '17px', fontWeight: 800 }}>{`${currentUser.ad} ${currentUser.soyad}`}</div>
						<div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>{currentUser.bolum}</div>
						<RoleBadge role={currentUser.rolBilgi} bosMetin={t('roleNone')} />
					</div>
				</div>

				<div>
					<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
						<span>{fill(t('mobLevel'), { n: level.seviye })}</span>
						<span style={{ opacity: 0.75 }}>{currentUser.xp || 0} XP</span>
					</div>
					<div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.12)', margin: '8px 0 6px', overflow: 'hidden' }}>
						<div style={{ height: '100%', width: `${Math.round(level.ilerleme * 100)}%`, background: 'linear-gradient(90deg, #0a84ff, #5e5ce6)' }} />
					</div>
					<div style={{ fontSize: '11.5px', opacity: 0.6 }}>{fill(t('mobXpToNext'), { n: Math.max(0, level.sonraki - (currentUser.xp || 0)) })}</div>
				</div>
			</div>

			{/* The badge grid is themed for windows, so it sits on a window-coloured card. */}
			<div style={{ background: 'var(--window-bg)', color: 'var(--text-primary)', borderRadius: '18px', padding: '16px', border: '1px solid var(--window-border)' }}>
				<BadgesGrid />
			</div>

			<div style={{ display: 'flex', gap: '10px' }}>
				<button type="button" data-mobile-action="settings" style={BUTTON} onClick={() => onOpenApp('settings')}>
					<Settings size={17} aria-hidden="true" /> {t('mobOpenSettings')}
				</button>
				<button type="button" data-mobile-action="logout" style={{ ...BUTTON, color: '#ff6961' }} onClick={() => void logout()}>
					<LogOut size={17} aria-hidden="true" /> {t('signOut')}
				</button>
			</div>
		</div>
	);
}
