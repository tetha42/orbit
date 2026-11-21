'use client';

import React from 'react';
import { AlertTriangle, Lock, Unlock, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import { MODALS_I18N } from './i18nModals';
import s from './SocModals.module.css';

export const LockdownModal = React.memo(function LockdownModal() {
	const {
		showLockdownModal,
		setShowLockdownModal,
		overview,
		confirmLockdownToggle,
		isSubmitting,
	} = useSoc();
	const { language } = useI18n();
	const copy = MODALS_I18N[language] ?? MODALS_I18N.en;

	if (!showLockdownModal) return null;

	const isCurrentlyActive = Boolean(overview?.lockdown.active);

	return (
		<div className={s.backdrop} onClick={() => setShowLockdownModal(false)}>
			<div className={s.sheetModal} onClick={(e) => e.stopPropagation()}>
				<div className={s.modalHeader}>
					<div className={s.modalHeaderTitle} style={{ color: isCurrentlyActive ? 'var(--text-primary)' : 'var(--danger)' }}>
						{isCurrentlyActive ? <Unlock size={16} /> : <AlertTriangle size={16} />}
						<span>{isCurrentlyActive ? copy.lockdownLiftTitle : copy.lockdownActivateTitle}</span>
					</div>
					<button
						type="button"
						className={s.closeBtn}
						onClick={() => setShowLockdownModal(false)}
					>
						<X size={14} />
					</button>
				</div>

				<div className={s.modalBody}>
					<p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
						{isCurrentlyActive ? copy.lockdownLiftDesc : copy.lockdownActivateDesc}
					</p>

					{!isCurrentlyActive && (
						<div
							style={{
								padding: '10px 12px',
								borderRadius: 8,
								background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
								border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
								fontSize: 12,
								color: 'var(--danger)',
								display: 'flex',
								flexDirection: 'column',
								gap: 4,
							}}
						>
							<strong>{copy.lockdownActionsHeader}</strong>
							<span>• POST /api/auth/register (503 Service Unavailable)</span>
							<span>• POST /api/auth/otp/request (503 Service Unavailable)</span>
							<span>• IPS Threat Scoring Multiplier: 2x</span>
						</div>
					)}
				</div>

				<div className={s.modalFooter}>
					<button
						type="button"
						className={s.btn}
						onClick={() => setShowLockdownModal(false)}
						disabled={isSubmitting}
					>
						{copy.lockdownCancel}
					</button>

					<button
						type="button"
						className={`${s.btn} ${isCurrentlyActive ? s.btnPrimary : s.btnDanger}`}
						onClick={() => void confirmLockdownToggle()}
						disabled={isSubmitting}
					>
						{isCurrentlyActive ? <Unlock size={13} /> : <Lock size={13} />}
						<span>{isCurrentlyActive ? copy.lockdownLiftBtn : copy.lockdownActivateBtn}</span>
					</button>
				</div>
			</div>
		</div>
	);
});
