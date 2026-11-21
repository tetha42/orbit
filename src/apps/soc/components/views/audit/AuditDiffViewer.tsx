'use client';

import React from 'react';
import { History } from 'lucide-react';
import { isPermissionApp, PERMISSION_DESCRIPTIONS } from '@/core/permissions';
import { getAppMeta } from '@/configs/apps.config';
import type { Language } from '@/lib/i18n';
import type { AppID } from '@/types/workspace';
import type { DiffRow } from '@/lib/audit';
import s from '../SocAuditView.module.css';

interface AuditDiffViewerProps {
	diffs: DiffRow[];
	language: Language;
	t: (key: string, fallback?: string) => string;
	formatAuditValue: (field: string, val: unknown) => string;
}

export function AuditDiffViewer({ diffs, language, t, formatAuditValue }: AuditDiffViewerProps) {
	if (diffs.length === 0) {
		return (
			<div className={s.emptyState}>
				<History size={24} style={{ opacity: 0.3 }} />
				<span>{t('auditNoChangesRecorded')}</span>
			</div>
		);
	}

	const resolveLabel = (field: string): string => {
		const appKey = field.startsWith('izinler.') ? field.slice('izinler.'.length) : field;
		if (!isPermissionApp(appKey)) return t(`auditField_${field}`, field);
		const appMeta = getAppMeta(appKey as AppID, language);
		return appMeta?.shortTitle || appMeta?.title || PERMISSION_DESCRIPTIONS[appKey]?.name || appKey;
	};

	return (
		<>
			<div className={s.diffTableWrap}>
				<table className={s.diffTable}>
					<thead>
						<tr>
							<th style={{ width: '38%' }}>{t('auditField')}</th>
							<th style={{ width: '31%' }}>{t('auditPreviousLabel')}</th>
							<th style={{ width: '31%' }}>{t('auditNextLabel')}</th>
						</tr>
					</thead>
					<tbody>
						{diffs.map((d) => (
							<tr key={d.field}>
								<td>
									<strong style={{ color: 'var(--text-primary)' }}>{resolveLabel(d.field)}</strong>
									{d.field.includes('.') && (
										<span
											style={{
												display: 'block',
												fontSize: 10,
												color: 'var(--text-secondary)',
												opacity: 0.7,
											}}
										>
											{d.field}
										</span>
									)}
								</td>
								<td>
									<span className={s.diffOldVal}>{formatAuditValue(d.field, d.before)}</span>
								</td>
								<td>
									<span className={s.diffNewVal}>{formatAuditValue(d.field, d.after)}</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className={s.diffCardsMobile}>
				{diffs.map((d) => (
					<div key={`mobile-diff-${d.field}`} className={s.diffFieldCard}>
						<span className={s.diffFieldName}>{resolveLabel(d.field)}</span>
						<div className={s.diffComparison}>
							<div className={s.diffCol}>
								<span className={s.diffColLabel}>{t('auditPreviousLabel')}</span>
								<span className={s.diffOldVal}>{formatAuditValue(d.field, d.before)}</span>
							</div>
							<div className={s.diffCol}>
								<span className={s.diffColLabel}>{t('auditNextLabel')}</span>
								<span className={s.diffNewVal}>{formatAuditValue(d.field, d.after)}</span>
							</div>
						</div>
					</div>
				))}
			</div>
		</>
	);
}
