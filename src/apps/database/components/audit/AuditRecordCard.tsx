'use client';

import React from 'react';
import { Undo2, Clock, User } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { AuditRecord } from '../../types';

interface AuditRecordCardProps {
	record: AuditRecord;
	isReverting: boolean;
	onRevert: (record: AuditRecord) => void;
}

export function AuditRecordCard({ record, isReverting, onRevert }: AuditRecordCardProps) {
	const { t } = useI18n();
	const previous = record.before || {};
	const after = record.after || {};
	const pkVal = previous.pkVal ?? after.pkVal;
	const changedKeys = Object.keys(after).filter((k) => k !== 'pkCol' && k !== 'pkVal');

	return (
		<div
			style={{
				padding: '12px 16px',
				borderRadius: '10px',
				background: 'var(--fill-softer)',
				border: '1px solid var(--window-border)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: '16px',
				flexWrap: 'wrap',
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
					<span
						style={{
							fontSize: '11px',
							fontWeight: 700,
							padding: '2px 7px',
							borderRadius: '4px',
							background: 'var(--accent)',
							color: 'var(--accent-contrast)',
						}}
					>
						{record.targetId} #{String(pkVal)}
					</span>

					<span style={{ fontSize: '11.5px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
						<User size={11} />
						<strong>{record.actorName || t('dbAuditActorFallback')}</strong>
					</span>

					<span style={{ fontSize: '11px', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
						<Clock size={11} />
						{new Date(Number(record.timestamp)).toLocaleString()}
					</span>
				</div>

				{/* Diff pills */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
					{changedKeys.map((key) => {
						const oldVal = previous[key];
						const newVal = after[key];
						return (
							<div
								key={key}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									fontSize: '11.5px',
									fontFamily: 'monospace',
								}}
							>
								<span style={{ fontWeight: 600, minWidth: '80px' }}>{key}:</span>
								<span
									style={{
										padding: '1px 6px',
										borderRadius: '4px',
										background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
										color: 'var(--danger)',
										border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
									}}
								>
									{oldVal !== undefined && oldVal !== null ? String(oldVal) : 'NULL'}
								</span>
								<span style={{ opacity: 0.4 }}>→</span>
								<span
									style={{
										padding: '1px 6px',
										borderRadius: '4px',
										background: 'color-mix(in srgb, var(--success) 14%, transparent)',
										color: 'var(--success)',
										border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
									}}
								>
									{newVal !== undefined && newVal !== null ? String(newVal) : 'NULL'}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			{/* Revert action */}
			<button
				type="button"
				onClick={() => onRevert(record)}
				disabled={isReverting}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '6px',
					padding: '6px 12px',
					borderRadius: '6px',
					fontSize: '11.5px',
					fontWeight: 600,
					background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
					color: 'var(--warning)',
					border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
					cursor: isReverting ? 'not-allowed' : 'pointer',
					opacity: isReverting ? 0.6 : 1,
					transition: 'all 0.15s ease',
				}}
			>
				<Undo2 size={13} />
				<span>{isReverting ? t('dbAuditReverting') : t('dbAuditRevertBtn')}</span>
			</button>
		</div>
	);
}
