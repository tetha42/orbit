'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, Eye, History, Trash2 } from 'lucide-react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { downloadCsv } from '@/core/data/download';
import { formatDateTime } from '@/core/data/format';
import { useToast } from '@/core/ui/Toast';
import { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell/useContextMenu';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import ui from '@/core/ui/ui.module.css';
import { AUDIT_CSV_HEADERS, AUDIT_PAGE_SIZE, auditCsvRows, formatAuditAction, type AuditRecord } from '@/lib/audit';
import { fill } from '@/lib/text';
import { AuditFilterBar, type AuditQuery } from './AuditFilterBar';
import { AuditDetailModal } from './AuditDetailModal';
import s from './Roles.module.css';

interface AuditResponse {
	records: AuditRecord[];
	total: number;
	page: number;
	pageSize: number;
}

const EMPTY: AuditQuery = { user: '', role: '', action: '', from: '', to: '', page: 1 };

function query(f: AuditQuery, extra: Record<string, string> = {}): string {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(f)) if (v && v !== 1) p.set(k, String(v));
	for (const [k, v] of Object.entries(extra)) p.set(k, v);
	return `/api/audit?${p.toString()}`;
}

interface AuditHistoryRowProps {
	record: AuditRecord;
	language: string;
	onSelect: (record: AuditRecord) => void;
}

function AuditHistoryRow({ record, language, onSelect }: AuditHistoryRowProps) {
	const { t } = useI18n();

	const menuItems: MenuItem[] = [
		{
			id: 'view-audit-detail',
			label: t('ctxSettingsViewAudit'),
			icon: <Eye size={13} />,
			action: () => onSelect(record),
		},
		{
			id: 'copy-actor',
			label: t('ctxSettingsCopyActor'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(record.actorName || record.actorId || ''),
		},
	];

	if (record.targetName || record.targetId) {
		menuItems.push({
			id: 'copy-target',
			label: t('ctxSettingsCopyTarget'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(record.targetName || record.targetId || ''),
		});
	}

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<button
			type="button"
			className={s.auditRow}
			onClick={() => onSelect(record)}
			{...contextMenuProps}
		>
			<span className={s.auditOp} title={formatAuditAction(record.action, t)}>
				{formatAuditAction(record.action, t)}
			</span>
			<span className={s.auditTarget} title={record.targetName || record.targetId || ''}>
				{record.targetName || record.targetId || '—'}
			</span>
			<span className={s.auditActor} title={record.actorName || record.actorId}>
				{record.actorName || record.actorId}
			</span>
			<span className={s.auditDate}>{formatDateTime(record.timestamp, language === 'en' ? 'en-GB' : 'tr-TR')}</span>
		</button>
	);
}

export function AuditHistory({ roles, variant = 'settings' }: { roles: { id: string; name: string }[]; variant?: 'settings' | 'soc' }) {
	const { t, language } = useI18n();
	const notify = useToast();
	const dialog = useDialog();
	const [filter, setFilter] = useState<AuditQuery>(EMPTY);
	const [userDraft, setUserDraft] = useState('');
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [detail, setDetail] = useState<AuditRecord | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [clearing, setClearing] = useState(false);
	const { data, refetch, error, httpStatus } = useJsonResource<AuditResponse>(query(filter));

	if (httpStatus === 403) return null;

	const onPersonChanged = (value: string) => {
		setUserDraft(value);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setFilter((cur) => ({ ...cur, user: value.trim(), page: 1 })), 300);
	};

	const exportCsv = async () => {
		setDownloading(true);
		try {
			const res = await fetch(query(filter, { all: '1' }));
			if (!res.ok) throw new Error();
			const json = (await res.json()) as AuditResponse;
			const rows = auditCsvRows(json.records);
			downloadCsv('denetim-gecmisi', AUDIT_CSV_HEADERS, rows);
		} catch {
			notify(t('auditCsvHata'), 'error');
		} finally {
			setDownloading(false);
		}
	};

	const historyClear = async () => {
		const approval = await dialog.confirm({
			title: t('auditTemizle'),
			message: t('auditTemizleOnay'),
			tone: 'danger',
			confirmLabel: t('auditTemizle'),
		});
		if (!approval) return;

		setClearing(true);
		try {
			const res = await fetch('/api/audit', { method: 'DELETE' });
			if (!res.ok) throw new Error();
			notify(t('auditTemizlendi'));
			await refetch();
		} catch {
			notify(t('auditHata'), 'error');
		} finally {
			setClearing(false);
		}
	};

	const records = data?.records ?? [];
	const total = data?.total ?? 0;
	const totalPage = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

	return (
		<section className={`${s.audit} ${variant === 'soc' ? s.auditSoc : ''}`} aria-label={t('auditTitle')}>
			<div className={s.auditBar}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<h4 className={s.title} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
						<History size={16} /> {t('auditTitle')}
					</h4>
					<span className={ui.muted} style={{ fontSize: 12 }}>
						{fill(t('auditToplam'), { n: total, count: total })}
					</span>
				</div>
				<div className={s.auditBarActions}>
					<button
						type="button"
						className={ui.btn}
						onClick={exportCsv}
						disabled={downloading || total === 0}
						title={t('auditCsvIndir')}
					>
						<Download size={14} /> {downloading ? t('auditCsvIndiriliyor') : 'CSV'}
					</button>
					<button
						type="button"
						className={`${ui.btn} ${ui.btnDanger}`}
						onClick={historyClear}
						disabled={clearing || total === 0}
						title={t('auditTemizle')}
					>
						<Trash2 size={14} /> {t('auditTemizle')}
					</button>
				</div>
			</div>

			<AuditFilterBar
				filter={filter}
				userDraft={userDraft}
				roles={roles}
				onPersonChange={onPersonChanged}
				onRoleChange={(val) => setFilter((c) => ({ ...c, role: val, page: 1 }))}
				onActionChange={(val) => setFilter((c) => ({ ...c, action: val, page: 1 }))}
				onFromChange={(val) => setFilter((c) => ({ ...c, from: val, page: 1 }))}
				onToChange={(val) => setFilter((c) => ({ ...c, to: val, page: 1 }))}
				onResetFilters={() => {
					setUserDraft('');
					setFilter(EMPTY);
				}}
			/>

			{error && <div className={ui.error}>{t('auditHata')}</div>}

			<div className={s.auditList}>
				{records.length === 0 && (
					<div className={s.auditEmpty}>{data ? t('auditBos') : t('loading')}</div>
				)}
				{records.map((k) => (
					<AuditHistoryRow
						key={k.id}
						record={k}
						language={language}
						onSelect={setDetail}
					/>
				))}
			</div>

			{totalPage > 1 && (
				<div className={s.pager}>
					<button type="button" className={ui.btn} disabled={filter.page <= 1} onClick={() => setFilter((c) => ({ ...c, page: c.page - 1 }))} title={t('previous')}>
						<ChevronLeft size={14} />
					</button>
					<span style={{ fontSize: 12 }}>{fill(t('auditSayfa'), { current: filter.page, total: totalPage })}</span>
					<button type="button" className={ui.btn} disabled={filter.page >= totalPage} onClick={() => setFilter((c) => ({ ...c, page: c.page + 1 }))} title={t('next')}>
						<ChevronRight size={14} />
					</button>
				</div>
			)}

			<AuditDetailModal detail={detail} onClose={() => setDetail(null)} />
		</section>
	);
}
