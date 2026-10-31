import { useMemo, useState } from 'react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useAppCommand } from '@/core/commands';
import { useNow } from '@/lib/client/useSheet';
import { foldTr, fill } from '@/lib/text';
import { sendJson } from '@/core/data/http';
import { useToast } from '@/core/ui/Toast';
import type { EventView, EventsResponse, Tab } from '../types';

export function useEvents() {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';
	const { data, setData, refetch, error, httpStatus } = useJsonResource<EventsResponse>('/api/events');
	const events = useMemo(() => data?.etkinlikler ?? [], [data]);
	const manage = data?.izinler.manage ?? false;
	const now = useNow(30_000);

	const [tab, setTab] = useState<Tab>('upcoming');
	const [query, setQuery] = useState('');
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [form, setForm] = useState<{ event: EventView | null } | null>(null);
	const [ticketFor, setTicketFor] = useState<EventView | null>(null);
	const [projectorFor, setProjectorFor] = useState<EventView | null>(null);
	const [scanning, setScanning] = useState(false);
	const [busy, setBusy] = useState(false);

	const notify = useToast();

	const tabOf = (e: EventView): Tab => (e.status === 'taslak' ? 'drafts' : e.endTime >= now ? 'upcoming' : 'past');

	useAppCommand('events', (command) => {
		if (!manage) return notify(t('evManageOnlyToast'), 'error');
		if (command === 'new-event') setForm({ event: null });
		else if (command === 'projector') {
			const candidates = events
				.filter((e) => e.status === 'yayinda' && e.endTime > Date.now())
				.sort((a, b) => a.baslangic - b.baslangic);
			if (candidates[0]) setProjectorFor(candidates[0]);
			else notify(t('evNoUpcomingToast'), 'error');
		}
	});

	useFocusTarget('events', {
		ready: data !== null,
		apply: (target) => {
			const found = events.find((e) => e.id === target.itemId);
			if (found) {
				setTab(tabOf(found));
				setSelectedId(found.id);
			}
		},
		refetch,
	});

	const counts = useMemo(() => {
		const c = { upcoming: 0, past: 0, drafts: 0 };
		for (const e of events) c[e.status === 'taslak' ? 'drafts' : e.endTime >= now ? 'upcoming' : 'past'] += 1;
		return c;
	}, [events, now]);

	const visible = useMemo(() => {
		const q = foldTr(query.trim());
		const list = events.filter(
			(e) =>
				(e.status === 'taslak' ? 'drafts' : e.endTime >= now ? 'upcoming' : 'past') === tab &&
				(!q || foldTr(`${e.baslik} ${e.konum} ${e.aciklama}`).includes(q))
		);
		return tab === 'past' ? [...list].sort((a, b) => b.baslangic - a.baslangic) : list;
	}, [events, tab, query, now]);

	const selected = visible.find((e) => e.id === selectedId) ?? visible[0] ?? null;

	const act = async (body: Record<string, unknown>, success?: string) => {
		setBusy(true);
		const res = await sendJson<{ message?: string }>('/api/events', 'POST', body);
		setBusy(false);
		if (!res.ok) notify(res.error || t('kbActionFailed'), 'error');
		else {
			playSystemSound();
			notify(success ?? res.data.message ?? t('evSaved'));
		}
		await refetch();
		return res.ok;
	};

	const register = async (e: EventView) => {
		setData((d) =>
			d
				? {
						...d,
						etkinlikler: d.etkinlikler.map((x) =>
							x.id === e.id ? { ...x, benimKaydim: true, kayitliSayisi: x.kayitliSayisi + 1 } : x
						),
				  }
				: d
		);
		await act({ action: 'kaydol', etkinlikId: e.id });
	};

	const unregister = async (e: EventView) => {
		if (!(await dialog.confirm({ message: fill(t('evCancelConfirm'), { title: e.baslik }), tone: 'warning' }))) return;
		await act({ action: 'kaydiIptal', etkinlikId: e.id });
	};

	// Camera scan and typed entry both send the 6-character code shown on the projector.
	// The member's identity comes from the session; the code only says which window is live.
	const checkIn = async (kod: string) => {
		const shortCode = kod.trim().toUpperCase();
		const res = await sendJson<{ message: string; zaten: boolean }>('/api/events', 'POST', { action: 'yoklama', shortCode });
		if (!res.ok) notify(res.error || t('kbActionFailed'), 'error');
		else {
			playSystemSound();
			notify(res.data.message, res.data.zaten ? 'error' : 'success');
		}
		await refetch();
	};

	return {
		locale,
		data,
		error,
		httpStatus,
		refetch,
		events,
		manage,
		now,
		tab,
		setTab,
		tabOf,
		query,
		setQuery,
		selectedId,
		setSelectedId,
		form,
		setForm,
		ticketFor,
		setTicketFor,
		projectorFor,
		setProjectorFor,
		scanning,
		setScanning,
		busy,
		notify,
		counts,
		visible,
		selected,
		act,
		register,
		unregister,
		checkIn,
	};
}
