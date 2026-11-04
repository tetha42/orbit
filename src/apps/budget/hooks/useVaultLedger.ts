'use client';

import { useMemo, useState } from 'react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource } from '@/core/data/useJsonResource';
import {
	monthlyFeed,
	monthKey,
	filterRecords,
	formatMinor,
	categoryDistribution,
	runningBalance,
} from '@/lib/budget';
import { foldTr } from '@/lib/text';
import { useAppCommand } from '@/core/commands';
import type { VaultRecord, VaultResponse, VaultSummary } from '../types';
import { downloadCsv } from '@/core/data/download';
import { escapeHtml } from '@/core/text/escape';
import { openPrintWindow } from '@/core/data/print';
import { formatDate, formatDateTime } from '@/core/data/format';
import { useToast } from '@/core/ui/Toast';
import { useNow } from '@/lib/client/useSheet';
import { categoryLabel } from '../categoryLabel';

const tl = (minor: number) => `₺${formatMinor(minor)}`;
const dateFmt = (ms: number) => formatDate(ms);

interface UseVaultLedgerOptions {
	teamId: string | null;
	onChanged?: () => void;
	embedded?: boolean;
	vaults?: VaultSummary[];
}

export function useVaultLedger({ teamId, onChanged, embedded = false, vaults }: UseVaultLedgerOptions) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const notify = useToast();
	const now = useNow(60_000);

	const url = teamId ? `/api/budget?teamId=${encodeURIComponent(teamId)}` : '/api/budget';
	const { data, refetch, isLoading, httpStatus } = useJsonResource<VaultResponse>(url);

	const canWrite = !!data?.permission?.write;
	const isManagement = !!data?.permission?.manage;
	const records = useMemo(() => data?.records ?? [], [data]);
	const summary = data?.summary ?? null;

	const [typeValue, setType] = useState<'all' | 'income' | 'expense'>('all');
	const [category, setCategory] = useState('');
	const [month, setMonth] = useState('');
	const [search, setSearch] = useState('');
	const [modal, setModal] = useState<
		{ kind: 'new' } | { kind: 'edit'; registration: VaultRecord } | { kind: 'transfer' } | null
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

	const balances = useMemo(() => runningBalance(records), [records]);
	const distribution = useMemo(() => categoryDistribution(records), [records]);
	const months = useMemo(() => monthlyFeed(records, now, 6), [records, now]);
	const monthOptions = useMemo(
		() => [...new Set(records.map((r) => monthKey(r.date)))].sort().reverse(),
		[records]
	);
	const filtered = useMemo(
		() => filterRecords(records, { typeValue, category, month, search, fold: foldTr }),
		[records, typeValue, category, month, search]
	);
	const filteredIn = filtered
		.filter((r) => r.typeValue === 'income')
		.reduce((a, r) => a + r.amountMinor, 0);
	const filteredOut = filtered
		.filter((r) => r.typeValue === 'expense')
		.reduce((a, r) => a + r.amountMinor, 0);
	const anyFilter = typeValue !== 'all' || !!category || !!month || !!search.trim();
	const maxMonth = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
	const canTransfer = isManagement && !!vaults && vaults.length > 1;

	const remove = async (r: VaultRecord) => {
		const message = r.transferId
			? fill(t('kasaRevertTransferConfirm'), { target: r.counterpartVaultName ?? t('kasaOtherLedger') })
			: fill(t('kasaDeleteRecordConfirm'), { desc: r.description, amount: tl(r.amountMinor) });
		if (!(await dialog.confirm({ message, tone: 'danger' }))) return;
		const res = await fetch(`/api/budget?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
		if (res.ok) await changed(r.transferId ? t('kasaTransferReverted') : t('kasaRecordDeleted'));
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
				r.typeValue === 'income' ? t('kasaIncome') : t('kasaExpense'),
				categoryLabel(t, r.category),
				r.description,
				r.transferId ? (r.counterpartVaultName ?? '') : '',
				r.recorderNameSurname ?? '',
				(r.typeValue === 'income' ? r.amountMinor : -r.amountMinor) / 100,
				(balances.get(r.id) ?? 0) / 100,
				r.receiptPhotoUrl ? t('yes') : '',
			]);
		downloadCsv(
			data?.vault.name ?? 'vault',
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
					`<tr><td>${dateFmt(r.date)}</td><td>${r.typeValue === 'income' ? t('kasaIncome') : t('kasaExpense')}</td><td>${esc(r.category)}</td><td>${esc(r.description)}${r.transferId && r.counterpartVaultName ? ` <i>(${r.typeValue === 'income' ? t('kasaSource') : t('kasaTarget')}: ${esc(r.counterpartVaultName)})</i>` : ''}</td><td>${esc(r.recorderNameSurname ?? '')}</td><td class="n">${r.typeValue === 'income' ? '' : '−'}${formatMinor(r.amountMinor)}</td><td class="n">${formatMinor(balances.get(r.id) ?? 0)}</td></tr>`
			)
			.join('');
		const cats = distribution
			.map((d) => `<tr><td>${esc(categoryLabel(t, d.category))}</td><td class="n">${formatMinor(d.amountMinor)}</td><td class="n">%${Math.round(d.ratio * 100)}</td></tr>`)
			.join('');
		const scope = anyFilter
			? fill(t('kasaPrintFilteredScope'), { filtered: filtered.length, total: records.length })
			: fill(t('kasaAllRecordsCount'), { count: records.length });
		const title = `${data?.vault.name ?? t('kasaBalance')} — ${t('kasaAuditReportTitle')}`;
		const w = openPrintWindow({
			title,
			css: '.sum{display:flex;gap:24px;margin-top:10px}.sum div{border:1px solid #ccc;border-radius:6px;padding:6px 10px}.sign{display:flex;justify-content:space-between;margin-top:48px}.sign div{width:40%;border-top:1px solid #333;padding-top:4px;text-align:center}',
			body: `<h1>${esc(title)}</h1>
<div>${t('kasaReportDateLabel')}: ${formatDateTime(Date.now())} · ${scope}</div>
<div class="sum"><div>${t('kasaTotalIncome')}<br><b>${formatMinor(summary?.totalIncomeMinor ?? 0)} ₺</b></div><div>${t('kasaTotalExpense')}<br><b>${formatMinor(summary?.totalExpenseMinor ?? 0)} ₺</b></div><div>${t('kasaNetBalance')}<br><b>${formatMinor(summary?.netBalanceMinor ?? 0)} ₺</b></div></div>
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
		setType('all');
		setCategory('');
		setMonth('');
		setSearch('');
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
		typeValue,
		setType,
		category,
		setCategory,
		month,
		setMonth,
		search,
		setSearch,
		modal,
		setModal,
		changed,
		remove,
		exportCsv,
		printReport,
		clearFilter,
		balances,
		distribution,
		months,
		monthOptions,
		filtered,
		filteredIn,
		filteredOut,
		anyFilter,
		maxMonth,
	};
}
