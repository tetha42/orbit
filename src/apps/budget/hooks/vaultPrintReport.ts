import { escapeHtml } from '@/core/text/escape';
import { openPrintWindow } from '@/core/data/print';
import { fill } from '@/lib/text';
import { formatMinor } from '@/lib/budget';
import { formatDateTime } from '@/core/data/format';
import { categoryLabel } from '../categoryLabel';
import type { VaultRecord } from '../types';

type TranslateFn = (key: string, fallback?: string) => string;

interface PrintVaultInput {
	vaultName?: string;
	filtered: VaultRecord[];
	totalCount: number;
	anyFilter: boolean;
	balances: Map<string, number>;
	distribution: { category: string; amountMinor: number; ratio: number }[];
	summary?: { totalIncomeMinor: number; totalExpenseMinor: number; netBalanceMinor: number } | null;
	dateFmt: (ts: number) => string;
	t: TranslateFn;
	onPopupBlocked: () => void;
}

export function printVaultReport({
	vaultName,
	filtered,
	totalCount,
	anyFilter,
	balances,
	distribution,
	summary,
	dateFmt,
	t,
	onPopupBlocked,
}: PrintVaultInput) {
	const esc = escapeHtml;
	const rows = [...filtered]
		.reverse()
		.map((r) => {
			const kind = r.type === 'income' ? t('treasuryIncome') : t('treasuryExpense');
			const dir = r.type === 'income' ? t('treasurySource') : t('treasuryTarget');
			const transferNote =
				r.transferId && r.counterpartVaultName
					? ` <i>(${dir}: ${esc(r.counterpartVaultName)})</i>`
					: '';
			const sign = r.type === 'income' ? '' : '−';
			return (
				`<tr><td>${dateFmt(r.date)}</td><td>${kind}</td><td>${esc(categoryLabel(t, r.category))}</td>` +
				`<td>${esc(r.description)}${transferNote}</td>` +
				`<td>${esc(r.recorderName ?? '')}</td>` +
				`<td class="n">${sign}${formatMinor(r.amountMinor)}</td>` +
				`<td class="n">${formatMinor(balances.get(r.id) ?? 0)}</td></tr>`
			);
		})
		.join('');
	const cats = distribution
		.map(
			(d) =>
				`<tr><td>${esc(categoryLabel(t, d.category))}</td>` +
				`<td class="n">${formatMinor(d.amountMinor)}</td><td class="n">%${Math.round(d.ratio * 100)}</td></tr>`
		)
		.join('');
	const scope = anyFilter
		? fill(t('treasuryPrintFilteredScope'), { filtered: filtered.length, total: totalCount })
		: fill(t('treasuryAllRecordsCount'), { count: totalCount });
	const title = `${vaultName ?? t('treasuryBalance')} — ${t('treasuryAuditReportTitle')}`;
	const printCss =
		'.sum{display:flex;gap:24px;margin-top:10px}' +
		'.sum div{border:1px solid #ccc;border-radius:6px;padding:6px 10px}' +
		'.sign{display:flex;justify-content:space-between;margin-top:48px}' +
		'.sign div{width:40%;border-top:1px solid #333;padding-top:4px;text-align:center}';
	const summaryHtml =
		`<div class="sum"><div>${t('treasuryTotalIncome')}<br><b>${formatMinor(summary?.totalIncomeMinor ?? 0)} ₺</b></div>` +
		`<div>${t('treasuryTotalExpense')}<br><b>${formatMinor(summary?.totalExpenseMinor ?? 0)} ₺</b></div>` +
		`<div>${t('treasuryNetBalance')}<br><b>${formatMinor(summary?.netBalanceMinor ?? 0)} ₺</b></div></div>`;
	const catTable =
		`<h2>${t('treasuryPrintDistribution')}</h2><table><tr><th>${t('treasuryPrintCategory')}</th>` +
		`<th class="n">${t('treasuryPrintAmount')}</th><th class="n">${t('treasuryPrintShare')}</th></tr>` +
		`${cats || `<tr><td colspan="3">${t('treasuryNoExpenses')}</td></tr>`}</table>`;
	const txTable =
		`<h2>${t('treasuryTransactionsTitle')}</h2><table><tr><th>${t('treasuryColDate')}</th>` +
		`<th>${t('treasuryColType')}</th><th>${t('budgetColCategory')}</th><th>${t('treasuryColDesc')}</th>` +
		`<th>${t('budgetColUser')}</th><th class="n">${t('budgetColAmount')}</th>` +
		`<th class="n">${t('treasuryBalance')} (₺)</th></tr>` +
		`${rows || `<tr><td colspan="7">${t('treasuryNoRecords')}</td></tr>`}</table>`;
	const signHtml = `<div class="sign"><div>${t('treasuryPrintPreparedBy')}</div><div>${t('treasuryPrintAuditedBy')}</div></div>`;
	const w = openPrintWindow({
		title,
		css: printCss,
		body:
			`<h1>${esc(title)}</h1>\n` +
			`<div>${t('treasuryReportDateLabel')}: ${formatDateTime(Date.now())} · ${scope}</div>\n` +
			`${summaryHtml}\n${catTable}\n${txTable}\n${signHtml}`,
	});
	if (!w) onPopupBlocked();
}
