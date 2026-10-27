'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { TwoFactorSettingsPanel } from '@/apps/settings/components/Panels/TwoFactorSettingsPanel';

/**
 * Blocking prompt for members whose role requires two-factor auth but who have not
 * enrolled yet.
 *
 * Deliberately not dismissible: the server marks these sessions with
 * `mustSetup2fa`, and management surfaces (approvals, budget, SMTP) should not be
 * reachable without a second factor. Signing out is the only way past it.
 *
 * Once the code is accepted the server no longer asks for setup, but the modal stays
 * until the member confirms the recovery codes: they are shown once, and closing the
 * modal at that moment would throw them away unseen.
 */
export function TwoFactorEnforcementModal() {
	const { currentUser, logout } = useSession();
	const { t } = useI18n();
	const [showingRecovery, setShowingRecovery] = useState(false);

	if (!currentUser?.mustSetup2fa && !showingRecovery) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="twofa-enforce-title"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'rgba(0, 0, 0, 0.6)',
				backdropFilter: 'var(--glass-blur-scrim)',
				padding: '20px',
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '560px',
					maxHeight: '88vh',
					overflowY: 'auto',
					padding: '26px',
					borderRadius: '16px',
					background: 'var(--modal-bg, #ffffff)',
					border: '1px solid var(--window-border)',
					boxShadow: 'var(--shadow-window-active)',
					color: 'var(--text-primary)',
					display: 'flex',
					flexDirection: 'column',
					gap: '18px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: '40px',
							height: '40px',
							flexShrink: 0,
							borderRadius: '10px',
							background: 'rgba(255, 159, 10, 0.15)',
							color: '#ff9f0a',
						}}
					>
						<ShieldAlert size={20} />
					</div>
					<div>
						<h2 id="twofa-enforce-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
							{t('twofactorEnforceTitle')}
						</h2>
						<p style={{ margin: '6px 0 0', fontSize: '13px', opacity: 0.75, lineHeight: 1.5 }}>
							{t('twofactorEnforceDesc')}
						</p>
					</div>
				</div>

				<TwoFactorSettingsPanel
					autoStart
					onEnrolled={() => setShowingRecovery(true)}
					onRecoveryAcknowledged={() => setShowingRecovery(false)}
				/>

				<button
					onClick={logout}
					style={{
						alignSelf: 'flex-start',
						padding: '8px 14px',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
						background: 'transparent',
						color: 'inherit',
						fontSize: '12.5px',
						cursor: 'pointer',
					}}
				>
					{t('signOut')}
				</button>
			</div>
		</div>
	);
}
