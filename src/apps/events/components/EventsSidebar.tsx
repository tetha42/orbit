import React from 'react';
import { CalendarDays, CheckCircle2, Plus, Search, Copy } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import type { EventView, Tab } from '../types';
import { isLive, typeMeta } from '@/components/Events/eventsShared';
import ui from '@/core/ui/ui.module.css';
import styles from '@/components/Events/Events.module.css';

interface Props {
	manage: boolean;
	counts: { upcoming: number; past: number; drafts: number };
	tab: Tab;
	onTabChange: (t: Tab) => void;
	query: string;
	onQueryChange: (q: string) => void;
	data: unknown;
	error: unknown;
	httpStatus?: number;
	visible: EventView[];
	selectedId: string | null;
	onSelectId: (id: string) => void;
	locale: string;
	now: number;
	onNewEvent: () => void;
}

interface EventSidebarItemProps {
	e: EventView;
	isSelected: boolean;
	meta: ReturnType<typeof typeMeta>;
	monthStr: string;
	dayStr: string;
	locale: string;
	now: number;
	t: (k: string) => string;
	onSelectId: (id: string) => void;
}

function EventSidebarItem({
	e,
	isSelected,
	meta,
	monthStr,
	dayStr,
	locale,
	now,
	t,
	onSelectId,
}: EventSidebarItemProps) {
	const menuItems = React.useMemo<MenuItem[]>(() => {
		const items: MenuItem[] = [
			{
				id: `ev-open-${e.id}`,
				label: t('ctxEventsOpen'),
				icon: <CalendarDays size={13} />,
				action: () => onSelectId(e.id),
			},
			{
				id: `ev-copy-${e.id}`,
				label: t('ctxEventsCopyLink'),
				icon: <Copy size={13} />,
				action: () => {
					if (typeof window !== 'undefined') {
						void copyToClipboard(`${window.location.origin}/etkinlikler/${e.id}`);
					}
				},
			},
		];
		return items;
	}, [e.id, t, onSelectId]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<button
			type="button"
			data-focus-id={`event:${e.id}`}
			className={`${styles.item} ${isSelected ? styles.itemActive : ''} ${
				e.status === 'iptal' ? styles.itemCancelled : ''
			}`}
			style={{ '--type-color': meta.color } as React.CSSProperties}
			{...contextMenuProps}
			onClick={() => onSelectId(e.id)}
		>
			<span className={styles.dateBlock} aria-hidden>
				<div className={styles.dateMonth}>{monthStr}</div>
				<div className={styles.dateDay}>{dayStr}</div>
			</span>
			<span className={styles.itemBody}>
				<span className={styles.itemTitle}>{e.baslik}</span>
				<span className={styles.itemMeta}>
					{new Date(e.baslangic).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} · {e.konum}
				</span>
				<span className={styles.badges}>
					<span className={`${styles.badge} ${styles.b_type}`}>{t(meta.key)}</span>
					{isLive(e, now) && <span className={`${styles.badge} ${styles.b_live}`}>{t('evLive')}</span>}
					{e.status === 'taslak' && <span className={`${styles.badge} ${styles.b_draft}`}>{t('evDraft')}</span>}
					{e.status === 'iptal' && <span className={`${styles.badge} ${styles.b_cancelled}`}>{t('evCancelled')}</span>}
					{e.benimYoklamam ? (
						<span className={`${styles.badge} ${styles.b_attended}`}>
							<CheckCircle2 size={10} /> {t('evAttended')}
						</span>
					) : (
						e.benimKaydim && <span className={`${styles.badge} ${styles.b_registered}`}>{t('evRegistered')}</span>
					)}
				</span>
			</span>
		</button>
	);
}

export function EventsSidebar({
	manage,
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
	locale,
	now,
	onNewEvent,
}: Props) {
	const { t } = useI18n();
	const emptyText = tab === 'upcoming' ? t('evNoUpcoming') : tab === 'past' ? t('evNoPast') : t('evNoDrafts');
	const day = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: 'numeric' });
	const month = (ms: number) => new Date(ms).toLocaleDateString(locale, { month: 'short' });

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sideHead}>
				<div className={styles.sideTitle}>
					<CalendarDays size={18} color="#0a84ff" />
					{t('evTitle')}
					{manage && (
						<button
							type="button"
							className={ui.primaryBtn}
							style={{ marginLeft: 'auto', height: 28, padding: '0 10px', fontSize: 12 }}
							onClick={onNewEvent}
						>
							<Plus size={14} /> {t('evNew')}
						</button>
					)}
				</div>
				<div className={ui.segmented} role="tablist" style={{ display: 'flex' }}>
					{(['upcoming', 'past', ...(manage && counts.drafts ? (['drafts'] as const) : [])] as Tab[]).map((id) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={tab === id}
							className={`${ui.segment} ${tab === id ? ui.segmentActive : ''}`}
							style={{ flex: 1 }}
							onClick={() => onTabChange(id)}
						>
							{t(id === 'upcoming' ? 'evUpcoming' : id === 'past' ? 'evPast' : 'evDrafts')}{' '}
							{counts[id] > 0 && <span style={{ opacity: 0.6 }}>{counts[id]}</span>}
						</button>
					))}
				</div>
				<label className={ui.search} style={{ flex: 'none' }}>
					<Search size={14} />
					<input
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						placeholder={t('evSearch')}
						aria-label={t('evSearch')}
					/>
				</label>
			</div>
			<div className={styles.list}>
				{data === null && (error || (httpStatus ?? 0) >= 400) && (
					<div className={styles.empty}>{t('evLoadFailed')}</div>
				)}
				{data !== null && visible.length === 0 && <div className={styles.empty}>{emptyText}</div>}
				{visible.map((e) => {
					const meta = typeMeta(e.tur);
					return (
						<EventSidebarItem
							key={e.id}
							e={e}
							isSelected={selectedId === e.id}
							meta={meta}
							monthStr={month(e.baslangic)}
							dayStr={day(e.baslangic)}
							locale={locale}
							now={now}
							t={t}
							onSelectId={onSelectId}
						/>
					);
				})}
			</div>
		</aside>
	);
}
