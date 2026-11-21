'use client';

import React, { useState, useMemo } from 'react';
import { History, Copy, Check, FileText, Code2, ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/core/data/format';
import { useI18n } from '@/core/i18n';
import { copyToClipboard } from '@/lib/clipboard';
import { formatAuditAction, diffRows, type AuditRecord } from '@/lib/audit';
import { Sheet } from '@/core/ui/Sheet';
import { AUDIT_I18N } from './i18nAudit';
import { AuditDiffViewer } from './AuditDiffViewer';
import s from '../SocAuditView.module.css';

export function SocAuditDetailSheet({
	record,
	onClose,
	onPivotToSiem,
}: {
	record: AuditRecord;
	onClose: () => void;
	onPivotToSiem: (ip: string) => void;
}) {
	const { t, language } = useI18n();
	const copy = AUDIT_I18N[language] ?? AUDIT_I18N.en;
	const [activeTab, setActiveTab] = useState<'diff' | 'raw'>('diff');
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const diffs = useMemo(() => diffRows(record.before ?? null, record.after ?? null), [record.before, record.after]);

	const copyWithFeedback = (key: string, text: string) => {
		copyToClipboard(text);
		setCopiedField(key);
		setTimeout(() => setCopiedField(null), 1400);
	};

	const formatAuditValue = (field: string, val: unknown): string => {
		if (val === null || val === undefined) return '—';
		if (typeof val === 'boolean') return val ? t('auditYes') : t('auditNo');
		if (field === 'roleId' || field === 'movedToRoleId') {
			if (val === 'role_admin') return t('auditRoleAdmin', copy.roleAdminFallback);
			if (val === 'role_management_board') return t('auditRoleBoard', copy.roleBoardFallback);
			if (val === 'role_member') return t('auditRoleMember', copy.roleMemberFallback);
			if (val === 'role_alumni') return t('auditRoleAlumni', copy.roleAlumniFallback);
		}
		if (
			typeof val === 'string' &&
			(val === 'none' ||
				val === 'use' ||
				val === 'manage' ||
				val === 'active' ||
				val === 'alumni' ||
				val === 'pending' ||
				val === 'rejected')
		) {
			return t(`auditValue_${val}`, val);
		}
		return String(val);
	};

	const actionTitle = formatAuditAction(record.action || '', t);
	const actorName = record.actorName || record.actorId || 'System';
	const targetName = record.targetName || record.targetId || '—';

	return (
		<Sheet title={actionTitle} label={actionTitle} icon={<History size={18} />} onClose={onClose} maxWidth={680}>
			<div className={s.modalSummaryGrid}>
				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditActor')}</span>
					<div className={s.summaryValue}>
						<span>{actorName}</span>
						<button
							type="button"
							className={s.copyMiniBtn}
							onClick={() => copyWithFeedback('actor', actorName)}
							title={copy.copyActor}
						>
							{copiedField === 'actor' ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
						</button>
					</div>
				</div>

				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditTarget')}</span>
					<div className={s.summaryValue}>
						<span>{targetName}</span>
						<button
							type="button"
							className={s.copyMiniBtn}
							onClick={() => copyWithFeedback('target', targetName)}
							title={copy.copyTarget}
						>
							{copiedField === 'target' ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
						</button>
					</div>
				</div>

				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditTimestamp')}</span>
					<div className={s.summaryValue}>
						<span style={{ fontVariantNumeric: 'tabular-nums' }}>
							{formatDateTime(record.timestamp ?? 0, copy.dateLocale)}
						</span>
					</div>
				</div>

				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditIp')}</span>
					<div className={s.summaryValue}>
						<code className={s.ipMono}>{record.ip || '127.0.0.1'}</code>
						<button
							type="button"
							className={s.copyMiniBtn}
							onClick={() => copyWithFeedback('ip', record.ip || '127.0.0.1')}
							title={copy.copyIp}
						>
							{copiedField === 'ip' ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
						</button>
						{record.ip && record.ip !== '127.0.0.1' && record.ip !== 'unknown' && (
							<button
								type="button"
								className={s.pivotBtn}
								onClick={() => onPivotToSiem(record.ip)}
								title={copy.pivotSiem}
							>
								<ExternalLink size={10} />
								<span>SIEM</span>
							</button>
						)}
					</div>
				</div>
			</div>

			<div className={s.modalTabs}>
				<button
					type="button"
					className={`${s.modalTabBtn} ${activeTab === 'diff' ? s.modalTabBtnActive : ''}`}
					onClick={() => setActiveTab('diff')}
				>
					<FileText size={13} />
					<span>{copy.tabDiff}</span>
				</button>
				<button
					type="button"
					className={`${s.modalTabBtn} ${activeTab === 'raw' ? s.modalTabBtnActive : ''}`}
					onClick={() => setActiveTab('raw')}
				>
					<Code2 size={13} />
					<span>{copy.tabRaw}</span>
				</button>
			</div>

			{activeTab === 'diff' && (
				<AuditDiffViewer diffs={diffs} language={language} t={t} formatAuditValue={formatAuditValue} />
			)}

			{activeTab === 'raw' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
						<button
							type="button"
							className={s.actionBtn}
							style={{ padding: '3px 9px', fontSize: 11 }}
							onClick={() => copyWithFeedback('json', JSON.stringify(record, null, 2))}
						>
							{copiedField === 'json' ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
							<span>{copiedField === 'json' ? copy.copied : copy.copyJson}</span>
						</button>
					</div>
					<pre className={s.jsonPre}>{JSON.stringify(record, null, 2)}</pre>
				</div>
			)}
		</Sheet>
	);
}
