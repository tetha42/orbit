'use client';

import React from 'react';
import { AlertTriangle, Lock, Unlock, X } from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import s from './SocModals.module.css';

export const LockdownModal = React.memo(function LockdownModal() {
	const {
		showLockdownModal,
		setShowLockdownModal,
		overview,
		confirmLockdownToggle,
		isSubmitting,
		isEn,
	} = useSoc();

	if (!showLockdownModal) return null;

	const isCurrentlyActive = Boolean(overview?.lockdown.active);

	return (
		<div className={s.backdrop} onClick={() => setShowLockdownModal(false)}>
			<div className={s.sheetModal} onClick={(e) => e.stopPropagation()}>
				<div className={s.modalHeader}>
					<div className={s.modalHeaderTitle} style={{ color: isCurrentlyActive ? 'var(--text-primary)' : 'var(--danger)' }}>
						{isCurrentlyActive ? <Unlock size={16} /> : <AlertTriangle size={16} />}
						<span>
							{isCurrentlyActive
								? isEn
									? 'Lift DEFCON 1 Lockdown?'
									: 'DEFCON 1 Kalkanını Kaldır?'
								: isEn
								? 'Activate DEFCON 1 Lockdown?'
								: 'DEFCON 1 Kalkan Modu Etkinleştirilsin mi?'}
						</span>
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
						{isCurrentlyActive
							? isEn
								? 'Lifting the Under Attack Lockdown will resume normal registration flows and return IPS threat scoring multipliers back to standard baseline.'
								: 'Kalkan kaldırıldığında yeni üye kayıtları ve şifre sıfırlama akışları normale dönecek, IPS tehdit çarpanı standart seviyeye indirilecektir.'
							: isEn
							? 'Activating Under Attack Lockdown will immediately pause new account registrations and password resets, and double IPS threat strike points across all endpoints.'
							: 'Saldırı Altındayız Kalkanı etkinleştirildiğinde yeni üye kayıtları ve şifre sıfırlama işlemleri durdurulur, IPS tehdit puanı çarpanı 2 katına çıkarılır.'}
					</p>

					{!isCurrentlyActive && (
						<div
							style={{
								padding: '10px 12px',
								borderRadius: 8,
								background: 'color-mix(in srgb, var(--danger, #d70015) 10%, transparent)',
								border: '1px solid color-mix(in srgb, var(--danger, #d70015) 25%, transparent)',
								fontSize: 12,
								color: 'var(--danger, #d70015)',
								display: 'flex',
								flexDirection: 'column',
								gap: 4,
							}}
						>
							<strong>{isEn ? 'Protective Actions Taken:' : 'Devreye Alınacak Önlemler:'}</strong>
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
						{isEn ? 'Cancel' : 'Vazgeç'}
					</button>

					<button
						type="button"
						className={`${s.btn} ${isCurrentlyActive ? s.btnPrimary : s.btnDanger}`}
						onClick={() => void confirmLockdownToggle()}
						disabled={isSubmitting}
					>
						{isCurrentlyActive ? <Unlock size={13} /> : <Lock size={13} />}
						<span>
							{isCurrentlyActive
								? isEn
									? 'Lift Lockdown'
									: 'Kalkanı Kaldır'
								: isEn
								? 'Activate Lockdown'
								: 'Kalkanı Etkinleştir'}
						</span>
					</button>
				</div>
			</div>
		</div>
	);
});
