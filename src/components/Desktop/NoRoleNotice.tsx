'use client';

import { KeyRound, Settings } from 'lucide-react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { YETKI_UYGULAMALARI, canUse } from '@/core/permissions';
import { OnboardingTeamExplorer } from './OnboardingTeamExplorer';

/**
 * Shown on the desktop (and the phone launcher) while the member's role opens
 * no app besides Settings — a new member nobody has given a role yet, or a
 * role that grants nothing. Without it the desktop would just look broken.
 *
 * A member with no role at all is not left facing a cold "no role" box: under
 * the explanation sits the team showcase, where they can look at the club's
 * teams and apply right away (see OnboardingTeamExplorer).
 */
export function NoRoleNotice({ compact = false }: { compact?: boolean }) {
	const { currentUser } = useSession();
	const { t } = useI18n();
	const { openApp } = useWindowActions();
	if (!currentUser || currentUser.mustSetup2fa) return null;
	const herhangiUygulama = YETKI_UYGULAMALARI.some((a) => a !== 'settings' && canUse(currentUser.izinler, a));
	if (herhangiUygulama) return null;

	const rolYok = !currentUser.rolBilgi;
	return (
		<div
			data-no-role-notice
			role="status"
			style={{
				...(compact
					? {}
					: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }),
				width: compact ? '100%' : rolYok ? '560px' : '420px',
				maxWidth: 'calc(100vw - 32px)',
				maxHeight: compact ? undefined : 'calc(100vh - 120px)',
				overflowY: compact ? undefined : 'auto',
				boxSizing: 'border-box',
				padding: '22px 24px',
				borderRadius: '18px',
				background: 'var(--window-bg)',
				border: '1px solid var(--window-border)',
				boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
				color: 'var(--text-primary)',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: '10px',
				textAlign: 'center',
				pointerEvents: 'auto',
			}}
			onClick={(e) => e.stopPropagation()}
		>
			<div style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(10, 132, 255, 0.15)', color: '#0a84ff' }}>
				<KeyRound size={22} />
			</div>
			<div style={{ fontSize: '15px', fontWeight: 700 }}>{rolYok ? t('noRoleTitle') : t('noAppsTitle')}</div>
			<div style={{ fontSize: '12.5px', lineHeight: 1.5, opacity: 0.75 }}>{rolYok ? t('noRoleBody') : t('noAppsBody')}</div>
			<button
				type="button"
				data-no-role-settings
				onClick={() => openApp('settings')}
				style={{
					marginTop: '4px',
					display: 'inline-flex',
					alignItems: 'center',
					gap: '6px',
					padding: '7px 14px',
					borderRadius: '8px',
					border: 'none',
					background: 'var(--accent-blue)',
					color: '#fff',
					fontSize: '12.5px',
					fontWeight: 600,
					cursor: 'pointer',
				}}
			>
				<Settings size={14} /> {t('noRoleOpenSettings')}
			</button>
			{rolYok && (
				<>
					<hr style={{ width: '100%', border: 0, borderTop: '1px solid var(--window-border)', margin: '8px 0 4px' }} />
					<OnboardingTeamExplorer compact={compact} />
				</>
			)}
		</div>
	);
}
