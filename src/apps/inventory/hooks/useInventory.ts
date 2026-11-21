import { useMemo, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useNow } from '@/lib/client/useSheet';
import { returnStatus } from '@/lib/inventory';
import { foldTr } from '@/lib/text';
import { useToast } from '@/core/ui/Toast';
import { useI18n } from '@/core/i18n';
import inventoryContract from '../inventory.contract.json';
import type { Filter, InventoryItem } from '../types';
import type { LoanMode } from '../components/LoanModal';

export function useInventory() {
	const { t } = useI18n();
	const { currentUserId, currentUser, canManageApp } = useSession();
	const { playSystemSound } = useSound();
	const isManager = canManageApp('inventory');
	const isAlumni = currentUser?.status === 'alumni';
	const now = useNow(60_000);

	const { data, refetch } = useJsonResource<InventoryItem[]>('/api/inventory');
	const items = useMemo(() => data ?? [], [data]);

	const [filter, setFilter] = useState<Filter>('all');
	const [category, setCategory] = useState('');
	const [search, setSearch] = useState('');
	const [detailId, setDetailId] = useState<string | null>(null);
	const [loan, setLoan] = useState<{ id: string; mode: LoanMode } | null>(null);
	const [form, setForm] = useState<{ id: string | null } | null>(null);

	useFocusTarget('inventory', {
		ready: data !== null,
		apply: (target) => {
			setFilter('all');
			setCategory('');
			setSearch('');
			if (target.itemId) setDetailId(target.itemId);
		},
		refetch,
	});

	const notify = useToast();
	const mapContractError = (message: string) => {
		const matched = inventoryContract.errorCodes.find((entry) => message.includes(entry.code));
		return matched ? t(matched.i18nKey, matched.description) : message;
	};
	const flash = (text: string, error = false) =>
		notify(error ? mapContractError(text) : text, error ? 'error' : 'success');

	const done = async (message: string, error = false) => {
		setLoan(null);
		setForm(null);
		if (!error) playSystemSound();
		flash(message, error);
		await refetch();
	};

	const overdue = (i: InventoryItem) =>
		i.status === 'on_loan' && !!returnStatus(i.dueDate, now)?.overdue;

	const counts = {
		all: items.length,
		available: items.filter((i) => i.status === 'available').length,
		on_loan: items.filter((i) => i.status === 'on_loan').length,
		overdue: items.filter(overdue).length,
		faulty: items.filter((i) => i.status === 'faulty').length,
		lost: items.filter((i) => i.status === 'lost').length,
		mine: items.filter((i) => i.status === 'on_loan' && i.holderUserId === currentUserId).length,
	};

	const categories = useMemo(
		() => [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b, 'tr')),
		[items]
	);

	const q = foldTr(search.trim());
	const visible = items
		.filter((i) => {
			if (filter === 'overdue' && !overdue(i)) return false;
			if (filter === 'mine' && !(i.status === 'on_loan' && i.holderUserId === currentUserId))
				return false;
			if (filter !== 'all' && filter !== 'overdue' && filter !== 'mine' && i.status !== filter)
				return false;
			if (category && i.category !== category) return false;
			return (
				!q ||
				foldTr(
					`${i.code} ${i.name} ${i.category} ${i.location} ${i.serialNo ?? ''} ${i.holderName ?? ''}`
				).includes(q)
			);
		})
		.sort(
			(a, b) =>
				Number(overdue(b)) - Number(overdue(a)) ||
				(a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) ||
				a.code.localeCompare(b.code)
		);

	const byId = (id: string | null) => items.find((i) => i.id === id) ?? null;

	return {
		currentUserId,
		isManager,
		isAlumni,
		now,
		data,
		items,
		filter,
		setFilter,
		category,
		setCategory,
		search,
		setSearch,
		detailId,
		setDetailId,
		loan,
		setLoan,
		form,
		setForm,
		done,
		flash,
		counts,
		categories,
		visible,
		byId,
	};
}
