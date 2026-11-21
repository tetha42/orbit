'use client';

import React from 'react';
import { History, Activity, RotateCcw, Download, Trash2 } from 'lucide-react';
import { fill } from '@/lib/text';
import type { AuditCopy } from './i18nAudit';
import s from '../SocAuditView.module.css';

interface AuditHeaderProps {
	copy: AuditCopy;
	t: (key: string, fallback?: string) => string;
	totalRecords: number;
	isLoading: boolean;
	exporting: boolean;
	clearing: boolean;
	canManage: boolean;
	onRefresh: () => void;
	onExportCsv: () => void;
	onPurgeLog: () => void;
}

export function AuditHeader({
	copy,
	t,
	totalRecords,
	isLoading,
	exporting,
	clearing,
	canManage,
	onRefresh,
	onExportCsv,
	onPurgeLog,
}: AuditHeaderProps) {
	return (
		<div className={s.cardHeader}>
			<div className={s.headerLeft}>
				<h2 className={s.cardTitle}>
					<History size={16} />
					<span>{copy.title}</span>
				</h2>
				<p className={s.cardSub}>{copy.subtitle}</p>
			</div>

			<div className={s.headerActions}>
				<span className={s.countBadge}>
					<Activity size={12} />
					<span>{fill(copy.eventsCount, { n: totalRecords, count: totalRecords })}</span>
				</span>

				<button
					type="button"
					className={s.actionBtn}
					onClick={onRefresh}
					disabled={isLoading}
					title={copy.refreshTitle}
				>
					<RotateCcw size={13} className={isLoading ? s.spin : ''} />
					<span>{copy.refresh}</span>
				</button>

				<button
					type="button"
					className={s.actionBtn}
					onClick={onExportCsv}
					disabled={exporting || totalRecords === 0}
					title={t('auditCsvIndir')}
				>
					<Download size={13} />
					<span>{exporting ? copy.exporting : 'CSV'}</span>
				</button>

				{canManage && (
					<button
						type="button"
						className={`${s.actionBtn} ${s.actionBtnDanger}`}
						onClick={onPurgeLog}
						disabled={clearing || totalRecords === 0}
						title={t('auditPurgeHistory')}
					>
						<Trash2 size={13} />
						<span>{copy.clearLog}</span>
					</button>
				)}
			</div>
		</div>
	);
}
