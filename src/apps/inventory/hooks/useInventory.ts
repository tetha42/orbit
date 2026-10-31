import { useMemo, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useNow } from '@/lib/client/useSheet';
import { returnStatus } from '@/lib/inventory';
import { foldTr } from '@/lib/text';
import { useToast } from '@/core/ui/Toast';
import type { Filter, InventoryItem } from '../types';
import type { LoanMode } from '../components/LoanModal';

export function useInventory() {
	const { currentUserId, currentUser, canManageApp } = useSession();
	const { playSystemSound } = useSound();
	const isManager = canManageApp('inventory');
	const isAlumni = currentUser?.status === 'mezun';
	const now = useNow(60_000);

	const { data, refetch } = useJsonResource<InventoryItem[]>('/api/inventory');
	const items = useMemo(() => data ?? [], [data]);

	const [filter, setFilter] = useState<Filter>('hepsi');
	const [kategori, setKategori] = useState('');
	const [arama, setArama] = useState('');
	const [detailId, setDetailId] = useState<string | null>(null);
	const [loan, setLoan] = useState<{ id: string; mode: LoanMode } | null>(null);
	const [form, setForm] = useState<{ id: string | null } | null>(null);

	useFocusTarget('inventory', {
		ready: data !== null,
		apply: (target) => {
			setFilter('hepsi');
			setKategori('');
			setArama('');
			if (target.itemId) setDetailId(target.itemId);
		},
		refetch,
	});

	const notify = useToast();
	const flash = (text: string, error = false) => notify(text, error ? 'error' : 'success');

	const done = async (message: string, error = false) => {
		setLoan(null);
		setForm(null);
		if (!error) playSystemSound();
		flash(message, error);
		await refetch();
	};

	const overdue = (i: InventoryItem) =>
		i.status === 'oduncte' && !!returnStatus(i.iadeTarihi, now)?.gecikti;

	const counts = {
		hepsi: items.length,
		saglam: items.filter((i) => i.status === 'saglam').length,
		oduncte: items.filter((i) => i.status === 'oduncte').length,
		gecikmis: items.filter(overdue).length,
		arizali: items.filter((i) => i.status === 'arizali').length,
		kayip: items.filter((i) => i.status === 'kayip').length,
		bende: items.filter((i) => i.status === 'oduncte' && i.oduncAlanId === currentUserId).length,
	};

	const categories = useMemo(
		() => [...new Set(items.map((i) => i.kategori))].sort((a, b) => a.localeCompare(b, 'tr')),
		[items]
	);

	const q = foldTr(arama.trim());
	const visible = items
		.filter((i) => {
			if (filter === 'gecikmis' && !overdue(i)) return false;
			if (filter === 'bende' && !(i.status === 'oduncte' && i.oduncAlanId === currentUserId))
				return false;
			if (filter !== 'hepsi' && filter !== 'gecikmis' && filter !== 'bende' && i.status !== filter)
				return false;
			if (kategori && i.kategori !== kategori) return false;
			return (
				!q ||
				foldTr(
					`${i.kod} ${i.ad} ${i.kategori} ${i.konum} ${i.seriNo ?? ''} ${i.oduncAlanAdSoyad ?? ''}`
				).includes(q)
			);
		})
		.sort(
			(a, b) =>
				Number(overdue(b)) - Number(overdue(a)) ||
				(a.iadeTarihi ?? Infinity) - (b.iadeTarihi ?? Infinity) ||
				a.kod.localeCompare(b.kod)
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
		kategori,
		setKategori,
		arama,
		setArama,
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
