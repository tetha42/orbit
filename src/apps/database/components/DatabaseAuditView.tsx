'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import { AuditRecordCard } from './audit/AuditRecordCard';
import type { AuditRecord } from '../types';

interface DatabaseAuditViewProps {
	dbToken: string;
	onRevertSuccess?: () => void;
}

export function DatabaseAuditView({ dbToken, onRevertSuccess }: DatabaseAuditViewProps) {
	const { t } = useI18n();
	const tRef = useRef(t);
	useEffect(() => {
		tRef.current = t;
	}, [t]);
	const dialog = useDialog();

	const [records, setRecords] = useState<AuditRecord[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [revertingId, setRevertingId] = useState<number | null>(null);

	const fetchAudit = useCallback(async () => {
		if (!dbToken) return;
		setIsLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/database/audit', {
				headers: { 'x-db-token': dbToken },
			});
			if (!res.ok) throw new Error(tRef.current('dbAuditFetchError'));
			const data = await res.json();
			setRecords(data.records || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : tRef.current('dbAuditReadError'));
		} finally {
			setIsLoading(false);
		}
	}, [dbToken]);

	useEffect(() => {
		void fetchAudit();
	}, [fetchAudit]);

	const handleRevert = async (rec: AuditRecord) => {
		const confirmed = await dialog.confirm({
			title: t('dbAuditRollbackTitle'),
			message: fill(t('dbAuditRollbackConfirm'), {
				table: String(rec.targetId ?? ''),
				id: rec.id,
			}),
			tone: 'warning',
		});

		if (!confirmed) return;

		setRevertingId(rec.id);
		try {
			const res = await fetch('/api/database/audit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({ auditId: rec.id }),
			});

			const data = await res.json();
			if (!res.ok) {
				await dialog.alert({
					title: t('dbAuditRollbackFailedTitle'),
					message: data.error || t('dbAuditRollbackFailedMsg'),
					tone: 'danger',
				});
				return;
			}

			await dialog.alert({
				title: t('dbAuditRollbackSuccessTitle'),
				message: data.message || t('dbAuditRollbackSuccessMsg'),
			});

			void fetchAudit();
			onRevertSuccess?.();
		} catch (err) {
			await dialog.alert({
				title: t('error'),
				message: err instanceof Error ? err.message : t('dbAuditNetworkError'),
				tone: 'danger',
			});
		} finally {
			setRevertingId(null);
		}
	};

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--window-bg)',
				overflow: 'hidden',
			}}
		>
			{/* Top bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '12px 18px',
					borderBottom: '1px solid var(--window-border)',
					background: 'var(--fill-softer)',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<ShieldCheck size={18} color="var(--success)" />
					<div>
						<div style={{ fontSize: '14px', fontWeight: 700 }}>
							{t('dbAuditBannerTitle')}
						</div>
						<div style={{ fontSize: '11px', opacity: 0.6 }}>
							{t('dbAuditBannerDesc')}
						</div>
					</div>
				</div>

				<button
					type="button"
					onClick={fetchAudit}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '5px',
						padding: '5px 12px',
						borderRadius: '6px',
						fontSize: '11.5px',
						background: 'var(--fill-soft)',
						border: '1px solid var(--window-border)',
						color: 'inherit',
						cursor: 'pointer',
					}}
				>
					<RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
					<span>{t('dbAuditRefresh')}</span>
				</button>
			</div>

			{/* Records list */}
			<div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
				{isLoading && records.length === 0 ? (
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6 }}>
						<RefreshCw size={20} className="animate-spin" />
					</div>
				) : error ? (
					<div style={{ padding: '20px', color: 'var(--danger)', textAlign: 'center' }}>{error}</div>
				) : records.length === 0 ? (
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							height: '100%',
							opacity: 0.5,
							gap: '8px',
						}}
					>
						<ShieldCheck size={32} />
						<div style={{ fontSize: '13px' }}>{t('dbAuditEmpty')}</div>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
						{records.map((rec) => (
							<AuditRecordCard
								key={rec.id}
								record={rec}
								isReverting={revertingId === rec.id}
								onRevert={handleRevert}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
