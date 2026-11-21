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
import { formatDate } from '@/core/data/format';
import { useToast } from '@/core/ui/Toast';
import { useNow } from '@/lib/client/useSheet';
import contract from '../budget.contract.json';
import { categoryLabel } from '../categoryLabel';
import { printVaultReport } from './vaultPrintReport';

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

	const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
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
		() => filterRecords(records, { type: typeFilter, category, month, search, fold: foldTr }),
		[records, typeFilter, category, month, search]
	);
	const filteredIn = filtered
		.filter((r) => r.type === 'income')
		.reduce((a, r) => a + r.amountMinor, 0);
	const filteredOut = filtered
		.filter((r) => r.type === 'expense')
		.reduce((a, r) => a + r.amountMinor, 0);
	const anyFilter = typeFilter !== 'all' || !!category || !!month || !!search.trim();
	const maxMonth = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
	const canTransfer = isManagement && !!vaults && vaults.length > 1;

	const remove = async (r: VaultRecord) => {
		const message = r.transferId
			? fill(t('treasuryRevertTransferConfirm'), { target: r.counterpartVaultName ?? t('treasuryOtherLedger') })
			: fill(t('treasuryDeleteRecordConfirm'), { desc: r.description, amount: tl(r.amountMinor) });
		if (!(await dialog.confirm({ message, tone: 'danger' }))) return;
		const res = await fetch(`/api/budget?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
		if (res.ok) await changed(r.transferId ? t('treasuryTransferReverted') : t('treasuryRecordDeleted'));
		else {
			const body = await res.json().catch(() => ({}));
			const entry = contract.errorCodes.find((e) => e.code === body?.errorCode);
			flash(entry ? t(entry.i18nKey) : body.error || t('actionFailed'), true);
		}
	};

	const exportCsv = () => {
		const rows = [...filtered]
			.reverse()
			.map((r) => [
				dateFmt(r.date),
				r.type === 'income' ? t('treasuryIncome') : t('treasuryExpense'),
				categoryLabel(t, r.category),
				r.description,
				r.transferId ? (r.counterpartVaultName ?? '') : '',
				r.recorderName ?? '',
				(r.type === 'income' ? r.amountMinor : -r.amountMinor) / 100,
				(balances.get(r.id) ?? 0) / 100,
				r.receiptUrl ? t('yes') : '',
			]);
		downloadCsv(
			data?.vault.name ?? 'vault',
			[
				t('treasuryColDate'),
				t('treasuryColType'),
				t('budgetColCategory'),
				t('treasuryColDesc'),
				t('treasuryColOpposite'),
				t('budgetColUser'),
				t('budgetColAmount'),
				`${t('treasuryBalance')} (TL)`,
				t('treasuryColReceipt'),
			],
			rows
		);
	};

	const printReport = () => {
		printVaultReport({
			vaultName: teamId === null ? t('treasuryGeneralTitle') : data?.vault.name,
			filtered,
			totalCount: records.length,
			anyFilter,
			balances,
			distribution,
			summary,
			dateFmt,
			t,
			onPopupBlocked: () => flash(t('treasuryPopupBlocked'), true),
		});
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
		setTypeFilter('all');
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
		typeFilter,
		setTypeFilter,
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
