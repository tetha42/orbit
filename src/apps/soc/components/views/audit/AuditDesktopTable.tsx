'use client';

import React from 'react';
import { PlusCircle, Sliders, Trash, ShieldAlert, Eye } from 'lucide-react';
import { formatDateTime } from '@/core/data/format';
import { formatAuditAction, type AuditRecord } from '@/lib/audit';
import { formatRelativeTime, getActionTone, getDiffSummary } from './auditUtils';
import type { AuditCopy } from './i18nAudit';
import s from '../SocAuditView.module.css';

interface AuditDesktopTableProps {
	records: AuditRecord[];
	copy: AuditCopy;
	t: (key: string, fallback?: string) => string;
	onInspect: (record: AuditRecord) => void;
}

export function AuditDesktopTable({ records, copy, t, onInspect }: AuditDesktopTableProps) {
	return (
		<div className={s.desktopTableWrap}>
			<table className={s.auditTable}>
				<thead>
					<tr>
						<th>{copy.colActionEvent}</th>
						<th>{t('auditActor')}</th>
						<th>{t('auditTarget')}</th>
						<th>{copy.colDiffSummary}</th>
						<th>{t('auditIp')}</th>
						<th>{t('auditTimestamp')}</th>
						<th style={{ textAlign: 'right' }}>{copy.colInspect}</th>
					</tr>
				</thead>
				<tbody>
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
							<tr key={record.id} className={s.auditTableRow} onClick={() => onInspect(record)}>
								<td>
									<span className={`${s.badge} ${toneClass}`}>
										{actionIcon}
										<span>{formatAuditAction(record.action || '', t)}</span>
									</span>
								</td>
								<td>
									<div className={s.userCell} title={actorName}>
										<div className={s.userAvatar}>{actorName.charAt(0).toUpperCase()}</div>
										<span className={s.userName}>{actorName}</span>
									</div>
								</td>
								<td>
									<span className={s.targetPill} title={targetName}>
										{targetName}
									</span>
								</td>
								<td>
									{diffSummary ? (
										<span className={s.diffChip}>{diffSummary}</span>
									) : (
										<span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>—</span>
									)}
								</td>
								<td>
									<code className={s.ipMono}>{record.ip || '127.0.0.1'}</code>
								</td>
								<td>
									<span
										className={s.timeText}
										title={formatDateTime(record.timestamp ?? 0, copy.dateLocale)}
									>
										{formatRelativeTime(record.timestamp ?? 0, copy)}
									</span>
								</td>
								<td style={{ textAlign: 'right' }}>
									<button
										type="button"
										className={s.actionBtn}
										style={{ padding: '3px 8px', fontSize: 11 }}
										onClick={(e) => {
											e.stopPropagation();
											onInspect(record);
										}}
										title={copy.inspectEventTitle}
									>
										<Eye size={12} />
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
