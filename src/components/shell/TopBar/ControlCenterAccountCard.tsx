'use client';

import { LogOut, Sparkles } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { RoleBadge, roleGradient } from '@/core/ui/RoleBadge';
import type { SessionUser } from '@/types/session';

interface ControlCenterAccountCardProps {
	currentUser: SessionUser;
	onLogout: () => void;
}

export function ControlCenterAccountCard({ currentUser, onLogout }: ControlCenterAccountCardProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				background: 'var(--card-bg)',
				border: '1px solid var(--card-border)',
				borderRadius: '10px',
				padding: '12px',
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					<div
						style={{
							width: '36px',
							height: '36px',
							borderRadius: '50%',
							background: roleGradient(currentUser.roleInfo?.color),
							color: '#fff',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontWeight: 700,
							fontSize: '14px',
							boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
						}}
					>
						{currentUser.name[0]}
						{currentUser.surname[0]}
					</div>
					<div>
						<div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--window-text)' }}>
							{currentUser.name} {currentUser.surname}
						</div>
						<div style={{ fontSize: '11px', opacity: 0.7 }}>{currentUser.department}</div>
					</div>
				</div>

				<button
					onClick={onLogout}
					title={t('signOut')}
					style={{
						padding: '6px',
						borderRadius: '6px',
						border: 'none',
						background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
						color: 'var(--danger)',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<LogOut size={14} />
				</button>
			</div>

			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					paddingTop: '6px',
					borderTop: '1px solid var(--card-border)',
				}}
			>
				<RoleBadge role={currentUser.roleInfo} emptyText={t('roleNone')} />
				<span
					style={{
						fontSize: '11px',
						fontWeight: 700,
						color: 'var(--warning)',
						display: 'flex',
						alignItems: 'center',
						gap: '4px',
					}}
				>
					<Sparkles size={12} />
					<span>{currentUser.xp || 0} XP</span>
				</span>
			</div>
		</div>
	);
}
