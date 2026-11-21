'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Plus, QrCode, RefreshCw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { EventView, Tab } from '../types';
import type { Notify } from '@/core/ui/Toast';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import { EventMobileCard } from './mobile/EventMobileCard';
import { EventMobileDetail } from './mobile/EventMobileDetail';
import s from '../EventsMobile.module.css';

interface EventsMobileViewProps {
	counts: { upcoming: number; past: number; drafts: number };
	tab: Tab;
	onTabChange: (t: Tab) => void;
	query: string;
	onQueryChange: (q: string) => void;
	data: unknown;
	error: unknown;
	httpStatus?: number | null;
	visible: EventView[];
	selectedId: string | null;
	onSelectId: (id: string | null) => void;
	selected: EventView | null;
	manage: boolean;
	now: number;
	locale: string;
	busy: boolean;
	notify: Notify;
	refetch: () => Promise<void>;
	tabOf: (e: EventView) => Tab;
	onRegister: (e: EventView) => void;
	onUnregister: (e: EventView) => void;
	onOpenTicket: (e: EventView) => void;
	onStartScan: () => void;
	onEdit: (e: EventView) => void;
	onAct: (body: Record<string, unknown>, success?: string) => Promise<boolean>;
	onProjector: (e: EventView) => void;
	onNewEvent: () => void;
}

export const EventsMobileView: React.FC<EventsMobileViewProps> = ({
	counts,
	tab,
	onTabChange,
	query,
	onQueryChange,
	data,
	error,
	httpStatus,
	visible,
	selectedId,
	onSelectId,
	selected,
	manage,
	now,
	locale,
	busy,
	notify,
	refetch,
	tabOf,
	onRegister,
	onUnregister,
	onOpenTicket,
	onStartScan,
	onEdit,
	onAct,
	onProjector,
	onNewEvent,
}) => {
	const { t } = useI18n();
	const [screen, setScreen] = useState<'list' | 'detail'>('list');
	const [detailTab, setDetailTab] = useState<'info' | 'attendance'>('info');
	const [manageSheetOpen, setManageSheetOpen] = useState(false);

	useMobileSubView(screen === 'detail');

	useEffect(() => {
		if (selectedId) {
			setScreen('detail');
			setManageSheetOpen(false);
		}
	}, [selectedId]);

	const emptyText = tab === 'upcoming' ? t('evNoUpcoming') : tab === 'past' ? t('evNoPast') : t('evNoDrafts');

	if (screen === 'detail' && selected) {
		return (
			<EventMobileDetail
				event={selected}
				manage={manage}
				now={now}
				locale={locale}
				busy={busy}
				notify={notify}
				detailTab={detailTab}
				setDetailTab={setDetailTab}
				manageSheetOpen={manageSheetOpen}
				setManageSheetOpen={setManageSheetOpen}
				tabOf={tabOf}
				onTabChange={onTabChange}
				onBack={() => {
					onSelectId(null);
					setScreen('list');
				}}
				refetch={refetch}
				onRegister={onRegister}
				onUnregister={onUnregister}
				onOpenTicket={onOpenTicket}
				onStartScan={onStartScan}
				onEdit={onEdit}
				onAct={onAct}
				onProjector={onProjector}
			/>
		);
	}

	return (
		<div className={s.root}>
			<div className={s.largeTitleWrap}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<h1 className={s.largeTitle}>{t('evTitle')}</h1>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						{manage && (
							<button type="button" className={s.iconBtn} onClick={onNewEvent} title={t('evNew')} style={{ color: 'var(--accent)' }}>
								<Plus size={18} />
							</button>
						)}
						<button type="button" className={s.iconBtn} onClick={() => void refetch()} title={t('refresh')}>
							<RefreshCw size={15} />
						</button>
					</div>
				</div>
			</div>

			<div className={s.segmentWrap}>
				<div className={s.segmentedBar} role="tablist">
					{(['upcoming', 'past', ...(manage && counts.drafts ? (['drafts'] as const) : [])] as Tab[]).map((id) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={tab === id}
							className={`${s.segmentBtn} ${tab === id ? s.segmentBtnActive : ''}`}
							onClick={() => onTabChange(id)}
						>
							<span>{t(id === 'upcoming' ? 'evUpcoming' : id === 'past' ? 'evPast' : 'evDrafts')}</span>
							{counts[id] > 0 && <span className={s.segmentBadge}>({counts[id]})</span>}
						</button>
					))}
				</div>
			</div>

			<div className={s.searchWrap}>
				<div className={s.searchBox}>
					<Search size={14} color="var(--text-muted)" />
					<input
						type="text"
						className={s.searchInput}
						placeholder={t('evSearch')}
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
					/>
					{query && (
						<button type="button" className={s.clearSearchBtn} onClick={() => onQueryChange('')}>
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			<div className={s.eventsScroll}>
				{data === null && (error || (httpStatus ?? 0) >= 400) && <div className={s.emptyState}>{t('evLoadFailed')}</div>}
				{data !== null && visible.length === 0 && <div className={s.emptyState}>{emptyText}</div>}
				{visible.map((e) => (
					<EventMobileCard
						key={e.id}
						event={e}
						locale={locale}
						now={now}
						onSelect={() => {
							onSelectId(e.id);
							setDetailTab('info');
							setScreen('detail');
						}}
					/>
				))}
			</div>

			<div className={s.bottomToolbar}>
				<span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
					{visible.length} · {t('evTitle')}
				</span>

				<button type="button" className={s.toolbarBtn} onClick={onStartScan} title={t('evCheckIn')}>
					<QrCode size={18} />
					<span>{t('evCheckIn')}</span>
				</button>
			</div>
		</div>
	);
};
