'use client';

import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { RoleBadge, roleGradient } from '@/core/ui/RoleBadge';
import type { AppID } from '@/types/workspace';
import type { SessionUser } from '@/types/session';
import { MobileDashboard } from './MobileDashboard';

interface MobileHomeTabProps {
	currentUser: SessionUser | null;
	smtpMissing: boolean;
	onOpenApp: (appId: AppID) => void;
}

export function MobileHomeTab({ currentUser, smtpMissing, onOpenApp }: MobileHomeTabProps) {
	const { t } = useI18n();

	return (
		<>
			<div
				style={{
					background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
					border: '1px solid rgba(255, 255, 255, 0.12)',
					borderRadius: '18px',
					padding: '16px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: '10px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
					<div
						style={{
							width: '44px',
							height: '44px',
							borderRadius: '50%',
							background: roleGradient(currentUser?.roleInfo?.color),
							display: 'grid',
							placeItems: 'center',
							fontWeight: 700,
							fontSize: '15px',
							flexShrink: 0,
						}}
					>
						{currentUser ? `${currentUser.name[0] ?? ''}${currentUser.surname[0] ?? ''}` : ''}
					</div>
					<div style={{ minWidth: 0 }}>
						<div style={{ fontSize: '15px', fontWeight: 700 }}>
							{currentUser ? `${currentUser.name} ${currentUser.surname}` : ''}
						</div>
						<div style={{ fontSize: '11.5px', opacity: 0.7 }}>
							{currentUser ? `${currentUser.department} • ${currentUser.xp || 0} XP` : ''}
						</div>
					</div>
				</div>

				<RoleBadge role={currentUser?.roleInfo} emptyText={t('roleNone')} />
			</div>

			{smtpMissing && (
				<div
					onClick={() => onOpenApp('settings')}
					style={{
						background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 15%, transparent), color-mix(in srgb, var(--warning) 8%, transparent))',
						border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)',
						borderRadius: '14px',
						padding: '12px 14px',
						display: 'flex',
						alignItems: 'center',
						gap: '10px',
						cursor: 'pointer',
					}}
				>
					<AlertTriangle size={20} color="#ffbd2e" style={{ flexShrink: 0 }} />
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ fontWeight: 700, fontSize: '13px', color: '#ffbd2e' }}>{t('smtpBadgeLabel')}</div>
						<div style={{ fontSize: '11px', opacity: 0.8, color: '#fff' }}>
							{t('smtpMobileHint')}
						</div>
					</div>
				</div>
			)}

			<MobileDashboard onOpenApp={onOpenApp} />
		</>
	);
}
