'use client';

import React from 'react';
import { PlusCircle, Sliders, Trash, ShieldAlert, ArrowRight, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/core/data/format';
import { formatAuditAction, type AuditRecord } from '@/lib/audit';
import { formatRelativeTime, getActionTone, getDiffSummary } from './auditUtils';
import type { AuditCopy } from './i18nAudit';
import s from '../SocAuditView.module.css';

interface AuditMobileCardsProps {
	records: AuditRecord[];
	copy: AuditCopy;
	t: (key: string, fallback?: string) => string;
	onInspect: (record: AuditRecord) => void;
}

export function AuditMobileCards({ records, copy, t, onInspect }: AuditMobileCardsProps) {
	return (
		<div className={s.mobileCardStream}>
			{records.map((record) => {
				const tone = getActionTone(record.action || '');
				const toneClass =
					tone === 'create'
						? s.badgeCreate
						: tone === 'delete'
						? s.badgeDelete
						: tone === 'security'
						? s.badgeSecurity
						: s.badgeUpdate;

				const actionIcon =
					tone === 'create' ? (
						<PlusCircle size={11} />
					) : tone === 'delete' ? (
						<Trash size={11} />
					) : tone === 'security' ? (
						<ShieldAlert size={11} />
					) : (
						<Sliders size={11} />
					);

				const diffSummary = getDiffSummary(record, t, copy);
				const actorName = record.actorName || record.actorId || 'System';
				const targetName = record.targetName || record.targetId || '—';

				return (
					<button
						type="button"
						key={`mobile-${record.id}`}
						className={s.auditCardItem}
						onClick={() => onInspect(record)}
					>
						<div className={s.cardTopRow}>
							<span className={`${s.badge} ${toneClass}`}>
								{actionIcon}
								<span>{formatAuditAction(record.action || '', t)}</span>
							</span>
							<span
								className={s.timeText}
								title={formatDateTime(record.timestamp ?? 0, copy.dateLocale)}
							>
								{formatRelativeTime(record.timestamp ?? 0, copy)}
							</span>
						</div>

						<div className={s.cardFlowRow}>
							<div className={s.userCell}>
								<div className={s.userAvatar}>{actorName.charAt(0).toUpperCase()}</div>
								<span className={s.userName}>{actorName}</span>
							</div>
							<span className={s.flowArrow}>
								<ArrowRight size={12} />
							</span>
							<span className={s.targetPill}>{targetName}</span>
						</div>

						<div className={s.cardBottomRow}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<code className={s.ipMono}>{record.ip || '127.0.0.1'}</code>
								{diffSummary && <span className={s.diffChip}>{diffSummary}</span>}
							</div>
							<span className={s.inspectHint}>
								<span>{copy.details}</span>
								<ChevronRight size={12} />
							</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}
