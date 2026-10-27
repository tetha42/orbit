'use client';

import { useMemo, useState } from 'react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource } from '@/core/data/useJsonResource';
import {
	aylikAkis,
	ayAnahtari,
	filtreleKayitlar,
	formatKurus,
	kategoriDagilimi,
	yuruyenBakiye,
} from '@/lib/budget';
import { foldTr } from '@/lib/text';
import { useAppCommand } from '@/core/commands';
import type { KasaRecord, KasaResponse, KasaSummary } from '../types';
import { downloadCsv } from '@/core/data/download';
import { escapeHtml } from '@/core/text/escape';
import { openPrintWindow } from '@/core/data/print';
import { formatDate, formatDateTime } from '@/core/data/format';
import { useToast } from '@/core/ui/Toast';
import { useNow } from '@/lib/client/useSheet';

const tl = (kurus: number) => `₺${formatKurus(kurus)}`;
const dateFmt = (ms: number) => formatDate(ms);

interface UseKasaLedgerOptions {
	teamId: string | null;
	onChanged?: () => void;
	embedded?: boolean;
	kasalar?: KasaSummary[];
}

export function useKasaLedger({ teamId, onChanged, embedded = false, kasalar }: UseKasaLedgerOptions) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const notify = useToast();
	const now = useNow(60_000);

	const url = teamId ? `/api/budget?teamId=${encodeURIComponent(teamId)}` : '/api/budget';
	const { data, refetch, isLoading, httpStatus } = useJsonResource<KasaResponse>(url);

	const canWrite = !!data?.izin?.yaz;
	const isManagement = !!data?.izin?.yonet;
	const records = useMemo(() => data?.kayitlar ?? [], [data]);
	const summary = data?.ozet ?? null;

	const [tur, setTur] = useState<'hepsi' | 'gelir' | 'gider'>('hepsi');
	const [kategori, setKategori] = useState('');
	const [ay, setAy] = useState('');
	const [arama, setArama] = useState('');
	const [modal, setModal] = useState<
		{ kind: 'new' } | { kind: 'edit'; registration: KasaRecord } | { kind: 'transfer' } | null
	>(null);

	const flash = (text: string, error = false) => notify(text, error ? 'error' : 'success');

	const changed = async (message?: string) => {
		setModal(null);
		if (message) {
			playSystemSound();
			flash(message);
		}
		await refetch();
		onChanged?.();
	};

	const balances = useMemo(() => yuruyenBakiye(records), [records]);
	const dagilim = useMemo(() => kategoriDagilimi(records), [records]);
	const aylar = useMemo(() => aylikAkis(records, now, 6), [records, now]);
	const monthOptions = useMemo(
		() => [...new Set(records.map((r) => ayAnahtari(r.date)))].sort().reverse(),
		[records]
	);
	const filtered = useMemo(
		() => filtreleKayitlar(records, { tur, kategori, ay, arama, fold: foldTr }),
		[records, tur, kategori, ay, arama]
	);
	const filteredIn = filtered
		.filter((r) => r.tur === 'gelir')
		.reduce((a, r) => a + r.tutarKurus, 0);
	const filteredOut = filtered
		.filter((r) => r.tur === 'gider')
		.reduce((a, r) => a + r.tutarKurus, 0);
	const anyFilter = tur !== 'hepsi' || !!kategori || !!ay || !!arama.trim();
	const maxMonth = Math.max(1, ...aylar.map((m) => Math.max(m.gelir, m.gider)));
	const canTransfer = isManagement && !!kasalar && kasalar.length > 1;

	const remove = async (r: KasaRecord) => {
		const message = r.aktarimId
			? fill(t('kasaRevertTransferConfirm'), { target: r.karsiKasaAd ?? t('kasaOtherLedger') })
			: fill(t('kasaDeleteRecordConfirm'), { desc: r.aciklama, amount: tl(r.tutarKurus) });
		if (!(await dialog.confirm({ message, tone: 'danger' }))) return;
		const res = await fetch(`/api/budget?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
		if (res.ok) await changed(r.aktarimId ? t('kasaTransferReverted') : t('kasaRecordDeleted'));
		else {
			const body = await res.json().catch(() => ({}));
			flash(body.error || t('actionFailed'), true);
		}
	};

	const exportCsv = () => {
		const rows = [...filtered]
			.reverse()
			.map((r) => [
				dateFmt(r.date),
				r.tur === 'gelir' ? t('kasaIncome') : t('kasaExpense'),
				r.kategori,
				r.aciklama,
				r.aktarimId ? (r.karsiKasaAd ?? '') : '',
				r.kaydedenAdSoyad ?? '',
				(r.tur === 'gelir' ? r.tutarKurus : -r.tutarKurus) / 100,
				(balances.get(r.id) ?? 0) / 100,
				r.fisFotoUrl ? t('yes') : '',
			]);
		downloadCsv(
			data?.kasa.ad ?? 'kasa',
			[
				t('kasaColDate'),
				t('kasaColType'),
				t('budgetColCategory'),
				t('kasaColDesc'),
				t('kasaColOpposite'),
				t('budgetColUser'),
				`${t('budgetColAmount')} (TL)`,
				`${t('kasaBalance')} (TL)`,
				t('kasaColReceipt'),
			],
			rows
		);
	};

	const printReport = () => {
		const esc = escapeHtml;
		const rows = [...filtered]
			.reverse()
			.map(
				(r) =>
					`<tr><td>${dateFmt(r.date)}</td><td>${r.tur === 'gelir' ? t('kasaIncome') : t('kasaExpense')}</td><td>${esc(r.kategori)}</td><td>${esc(r.aciklama)}${r.aktarimId && r.karsiKasaAd ? ` <i>(${r.tur === 'gelir' ? t('kasaSource') : t('kasaTarget')}: ${esc(r.karsiKasaAd)})</i>` : ''}</td><td>${esc(r.kaydedenAdSoyad ?? '')}</td><td class="n">${r.tur === 'gelir' ? '' : '−'}${formatKurus(r.tutarKurus)}</td><td class="n">${formatKurus(balances.get(r.id) ?? 0)}</td></tr>`
			)
			.join('');
		const cats = dagilim
			.map((d) => `<tr><td>${esc(d.kategori)}</td><td class="n">${formatKurus(d.tutarKurus)}</td><td class="n">%${Math.round(d.oran * 100)}</td></tr>`)
			.join('');
		const scope = anyFilter
			? fill(t('kasaPrintFilteredScope'), { filtered: filtered.length, total: records.length })
			: fill(t('kasaAllRecordsCount'), { count: records.length });
		const title = `${data?.kasa.ad ?? t('kasaBalance')} — ${t('kasaAuditReportTitle')}`;
		const w = openPrintWindow({
			title,
			css: '.sum{display:flex;gap:24px;margin-top:10px}.sum div{border:1px solid #ccc;border-radius:6px;padding:6px 10px}.sign{display:flex;justify-content:space-between;margin-top:48px}.sign div{width:40%;border-top:1px solid #333;padding-top:4px;text-align:center}',
			body: `<h1>${esc(title)}</h1>
<div>${t('kasaReportDateLabel')}: ${formatDateTime(Date.now())} · ${scope}</div>
<div class="sum"><div>${t('kasaTotalIncome')}<br><b>${formatKurus(summary?.toplamGelirKurus ?? 0)} ₺</b></div><div>${t('kasaTotalExpense')}<br><b>${formatKurus(summary?.toplamGiderKurus ?? 0)} ₺</b></div><div>${t('kasaNetBalance')}<br><b>${formatKurus(summary?.netBakiyeKurus ?? 0)} ₺</b></div></div>
<h2>${t('kasaPrintDistribution')}</h2><table><tr><th>${t('kasaPrintCategory')}</th><th class="n">${t('kasaPrintAmount')}</th><th class="n">${t('kasaPrintShare')}</th></tr>${cats || `<tr><td colspan="3">${t('kasaNoExpenses')}</td></tr>`}</table>
<h2>${t('kasaTransactionsTitle')}</h2><table><tr><th>${t('kasaColDate')}</th><th>${t('kasaColType')}</th><th>${t('budgetColCategory')}</th><th>${t('kasaColDesc')}</th><th>${t('budgetColUser')}</th><th class="n">${t('budgetColAmount')} (₺)</th><th class="n">${t('kasaBalance')} (₺)</th></tr>${rows || `<tr><td colspan="7">${t('kasaNoRecords')}</td></tr>`}</table>
<div class="sign"><div>${t('kasaPrintPreparedBy')}</div><div>${t('kasaPrintAuditedBy')}</div></div>`,
		});
		if (!w) flash(t('kasaPopupBlocked'), true);
	};

	useAppCommand(
		'budget',
		(command) => {
			if (command === 'new-entry' && canWrite) setModal({ kind: 'new' });
			else if (command === 'print-report') printReport();
		},
		!embedded
	);

	const clearFilter = () => {
		setTur('hepsi');
		setKategori('');
		setAy('');
		setArama('');
	};

	return {
		t,
		language,
		data,
		records,
		summary,
		isLoading,
		httpStatus,
		canWrite,
		isManagement,
		canTransfer,
		tur,
		setTur,
		kategori,
		setKategori,
		ay,
		setAy,
		arama,
		setArama,
		modal,
		setModal,
		changed,
		remove,
		exportCsv,
		printReport,
		clearFilter,
		balances,
		dagilim,
		aylar,
		monthOptions,
		filtered,
		filteredIn,
		filteredOut,
		anyFilter,
		maxMonth,
	};
}
