'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, ShieldCheck, XCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useLiveEvent, useSession } from '@/core/session';
import type { DeviceLoginApprovalRecord } from './types';

export function MobileLoginApprovalModal({ eagerPoll = true }: { eagerPoll?: boolean } = {}) {
	const { t } = useI18n();
	const { isAuthenticated } = useSession();
	const [approvals, setApprovals] = useState<DeviceLoginApprovalRecord[]>([]);
	const [busyId, setBusyId] = useState<string | null>(null);

	const fetchPending = useCallback(async () => {
		if (!isAuthenticated) return;
		try {
			const res = await fetch('/api/auth/devices/approval/pending', { cache: 'no-store' });
			if (!res.ok) return;
			const data = (await res.json()) as { approvals?: DeviceLoginApprovalRecord[] };
			if (Array.isArray(data.approvals)) {
				setApprovals(data.approvals);
			}
		} catch {
			// ignore transient network errors
		}
	}, [isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated) {
			setApprovals([]);
			return;
		}
		if (eagerPoll) void fetchPending();
	}, [isAuthenticated, eagerPoll, fetchPending]);

	useLiveEvent((event) => {
		if (event === 'login_approval' || event === 'notification') {
			void fetchPending();
		}
	});

	const handleRespond = async (
		approvalId: string,
		decision: 'approve' | 'reject',
		selectedNumber?: number
	) => {
		if (busyId) return;
		setBusyId(approvalId);
		try {
			await fetch('/api/auth/devices/approval/respond', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ approvalId, decision, selectedNumber }),
			});
			setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
		} catch {
			// ignore
		} finally {
			setBusyId(null);
		}
	};

	const activePush = approvals.find((a) => a.mode === 'push' && a.status === 'pending');
	if (!activePush) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 100001,
				background: 'rgba(0, 0, 0, 0.72)',
				backdropFilter: 'blur(12px)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '18px',
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '380px',
					background: 'var(--window-bg)',
					color: 'var(--text-primary)',
					border: '1px solid var(--window-border)',
					borderRadius: '20px',
					padding: '22px',
					boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
					display: 'flex',
					flexDirection: 'column',
					gap: '16px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
					<div
						style={{
							width: '42px',
							height: '42px',
							borderRadius: '12px',
							background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
							color: 'var(--accent)',
							display: 'grid',
							placeItems: 'center',
							flexShrink: 0,
						}}
					>
						<ShieldCheck size={22} />
					</div>
					<div>
						<div style={{ fontSize: '15px', fontWeight: 700 }}>
							{t('devicesApprovalModalTitle')}
						</div>
						<div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
							{t('devicesApprovalModalDesc')}
						</div>
					</div>
				</div>

				<div
					style={{
						background: 'var(--surface-hover)',
						border: '1px solid var(--border-subtle)',
						borderRadius: '12px',
						padding: '12px',
						fontSize: '12.5px',
						display: 'flex',
						flexDirection: 'column',
						gap: '6px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
						<Monitor size={14} />
						<span>
							{t('devicesApprovalDeviceLabel')}: {activePush.desktopDeviceName}
						</span>
					</div>
					<div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
						{t('devicesApprovalIpLabel')}: {activePush.desktopIp}
					</div>
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
					{activePush.numberOptions.map((num) => (
						<button
							key={num}
							type="button"
							disabled={busyId === activePush.id}
							onClick={() => void handleRespond(activePush.id, 'approve', num)}
							style={{
								height: '58px',
								borderRadius: '14px',
								border: '2px solid var(--accent)',
								background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
								color: 'var(--text-primary)',
								fontSize: '22px',
								fontWeight: 800,
								cursor: 'pointer',
							}}
						>
							{num}
						</button>
					))}
				</div>

				<button
					type="button"
					disabled={busyId === activePush.id}
					onClick={() => void handleRespond(activePush.id, 'reject')}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '8px',
						height: '42px',
						borderRadius: '12px',
						border: '1px solid color(--border-subtle)',
						background: 'transparent',
						color: 'var(--danger)',
						fontSize: '13px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					<XCircle size={16} />
					{t('devicesApprovalRejectBtn')}
				</button>
			</div>
		</div>
	);
}
