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
import { AuditFilterBar, type Suzgec } from './AuditFilterBar';
import { AuditDetailModal } from './AuditDetailModal';
import s from './Roles.module.css';

interface AuditResponse {
	kayitlar: AuditRecord[];
	toplam: number;
	sayfa: number;
	boyut: number;
}

const BOS: Suzgec = { kisi: '', role: '', islem: '', from: '', to: '', sayfa: 1 };

function query(f: Suzgec, extra: Record<string, string> = {}): string {
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
			action: () => copyToClipboard(record.yapanAd || record.yapanId || ''),
		},
	];

	if (record.hedefAd || record.hedefId) {
		menuItems.push({
			id: 'copy-target',
			label: t('ctxSettingsCopyTarget'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(record.hedefAd || record.hedefId || ''),
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
			<span className={s.auditOp} title={formatAuditAction(record.islem, t)}>
				{formatAuditAction(record.islem, t)}
			</span>
			<span className={s.auditTarget} title={record.hedefAd || record.hedefId || ''}>
				{record.hedefAd || record.hedefId || '—'}
			</span>
			<span className={s.auditActor} title={record.yapanAd || record.yapanId}>
				{record.yapanAd || record.yapanId}
			</span>
			<span className={s.auditDate}>{formatDateTime(record.zaman, language === 'en' ? 'en-GB' : 'tr-TR')}</span>
		</button>
	);
}

export function AuditHistory({ roller, variant = 'settings' }: { roller: { id: string; ad: string }[]; variant?: 'settings' | 'soc' }) {
	const { t, language } = useI18n();
	const notify = useToast();
	const dialog = useDialog();
	const [filtre, setFiltre] = useState<Suzgec>(BOS);
	const [kisiYazilan, setKisiYazilan] = useState('');
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [detay, setDetay] = useState<AuditRecord | null>(null);
	const [indiriliyor, setIndiriliyor] = useState(false);
	const [temizleniyor, setTemizleniyor] = useState(false);
	const { data, refetch, error, httpStatus } = useJsonResource<AuditResponse>(query(filtre));

	if (httpStatus === 403) return null;

	const onKisiDegisti = (deger: string) => {
		setKisiYazilan(deger);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setFiltre((cur) => ({ ...cur, kisi: deger.trim(), sayfa: 1 })), 300);
	};

	const exportCsv = async () => {
		setIndiriliyor(true);
		try {
			const res = await fetch(query(filtre, { tum: '1' }));
			if (!res.ok) throw new Error();
			const json = (await res.json()) as AuditResponse;
			const rows = auditCsvRows(json.kayitlar);
			downloadCsv('denetim-gecmisi', AUDIT_CSV_HEADERS, rows);
		} catch {
			notify(t('auditCsvHata'), 'error');
		} finally {
			setIndiriliyor(false);
		}
	};

	const gecmisiTemizle = async () => {
		const approval = await dialog.confirm({
			title: t('auditTemizle'),
			message: t('auditTemizleOnay'),
			tone: 'danger',
			confirmLabel: t('auditTemizle'),
		});
		if (!approval) return;

		setTemizleniyor(true);
		try {
			const res = await fetch('/api/audit', { method: 'DELETE' });
			if (!res.ok) throw new Error();
			notify(t('auditTemizlendi'));
			await refetch();
		} catch {
			notify(t('auditHata'), 'error');
		} finally {
			setTemizleniyor(false);
		}
	};

	const records = data?.kayitlar ?? [];
	const toplam = data?.toplam ?? 0;
	const toplamSayfa = Math.max(1, Math.ceil(toplam / AUDIT_PAGE_SIZE));

	return (
		<section className={`${s.audit} ${variant === 'soc' ? s.auditSoc : ''}`} aria-label={t('auditTitle')}>
			<div className={s.auditBar}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<h4 className={s.title} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
						<History size={16} /> {t('auditTitle')}
					</h4>
					<span className={ui.muted} style={{ fontSize: 12 }}>
						{fill(t('auditToplam'), { n: toplam, count: toplam })}
					</span>
				</div>
				<div className={s.auditBarActions}>
					<button
						type="button"
						className={ui.btn}
						onClick={exportCsv}
						disabled={indiriliyor || toplam === 0}
						title={t('auditCsvIndir')}
					>
						<Download size={14} /> {indiriliyor ? t('auditCsvIndiriliyor') : 'CSV'}
					</button>
					<button
						type="button"
						className={`${ui.btn} ${ui.btnDanger}`}
						onClick={gecmisiTemizle}
						disabled={temizleniyor || toplam === 0}
						title={t('auditTemizle')}
					>
						<Trash2 size={14} /> {t('auditTemizle')}
					</button>
				</div>
			</div>

			<AuditFilterBar
				filtre={filtre}
				kisiYazilan={kisiYazilan}
				roller={roller}
				onKisiChange={onKisiDegisti}
				onRolChange={(val) => setFiltre((c) => ({ ...c, role: val, sayfa: 1 }))}
				onIslemChange={(val) => setFiltre((c) => ({ ...c, islem: val, sayfa: 1 }))}
				onFromChange={(val) => setFiltre((c) => ({ ...c, from: val, sayfa: 1 }))}
				onToChange={(val) => setFiltre((c) => ({ ...c, to: val, sayfa: 1 }))}
				onResetFilters={() => {
					setKisiYazilan('');
					setFiltre(BOS);
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
						onSelect={setDetay}
					/>
				))}
			</div>

			{toplamSayfa > 1 && (
				<div className={s.pager}>
					<button type="button" className={ui.btn} disabled={filtre.sayfa <= 1} onClick={() => setFiltre((c) => ({ ...c, sayfa: c.sayfa - 1 }))} title={t('previous')}>
						<ChevronLeft size={14} />
					</button>
					<span style={{ fontSize: 12 }}>{fill(t('auditSayfa'), { current: filtre.sayfa, total: toplamSayfa })}</span>
					<button type="button" className={ui.btn} disabled={filtre.sayfa >= toplamSayfa} onClick={() => setFiltre((c) => ({ ...c, sayfa: c.sayfa + 1 }))} title={t('next')}>
						<ChevronRight size={14} />
					</button>
				</div>
			)}

			<AuditDetailModal detay={detay} onClose={() => setDetay(null)} />
		</section>
	);
}
