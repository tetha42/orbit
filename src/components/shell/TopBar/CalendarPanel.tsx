'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useJsonResource } from '@/core/data/useJsonResource';
import { formatTime } from '@/core/data/format';
import type { EventsResponse, EventView } from '@/components/Events/eventsShared';
import { fill } from '@/lib/text';
import { useWindowActions } from '@/core/windows';
import { useShell } from '@/core/shell';
import { addDays, addMonths, dayKey, dayLong, daysOfEvent, monthGrid, monthTitle, parseDayKey, weekStartOf, weekdayLabels } from './calendarGrid';
import styles from './Calendar.module.css';

/** What the arrow keys do on a day: days and weeks, PageUp/PageDown months. */
const MOVES: Record<string, (d: Date) => Date> = {
	ArrowLeft: (d) => addDays(d, -1),
	ArrowRight: (d) => addDays(d, 1),
	ArrowUp: (d) => addDays(d, -7),
	ArrowDown: (d) => addDays(d, 7),
	PageUp: (d) => addMonths(d, -1),
	PageDown: (d) => addMonths(d, 1),
};

/**
 * The month under the clock. Mounted only while open, so every opening starts on today
 * (read from the clock then) and asks `/api/events` afresh — and asks only when the
 * role may use the Events app: without it no request is made at all.
 */
export function CalendarPanel({ returnFocusTo }: { returnFocusTo: RefObject<HTMLElement | null> }) {
	const { language, t } = useI18n();
	const { canUseApp } = useSession();
	const [today] = useState(() => new Date());
	const [cursor, setCursor] = useState(today);
	const panelRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const focusAfterRender = useRef(false);

	const showEvents = canUseApp('events');
	const { data } = useJsonResource<EventsResponse>(showEvents ? '/api/events' : null);

	const weekStart = weekStartOf(language);
	const cells = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth(), weekStart), [cursor, weekStart]);
	const weekdays = useMemo(() => weekdayLabels(language, weekStart), [language, weekStart]);
	const todayKey = dayKey(today);
	const cursorKey = dayKey(cursor);

	const byDay = useMemo(() => {
		const map = new Map<string, EventView[]>();
		for (const e of data?.etkinlikler ?? []) {
			if (e.status === 'iptal' || e.status === 'taslak') continue;
			for (const k of daysOfEvent(e.baslangic, e.endTime)) map.set(k, [...(map.get(k) ?? []), e]);
		}
		return map;
	}, [data]);
	const dayEvents = byDay.get(cursorKey) ?? [];

	// Closing (Esc, the clock again) while the keyboard is inside: it goes back to the clock it came from.
	// An outside click has already moved focus, so that is left alone.
	useLayoutEffect(() => {
		const panel = panelRef.current;
		const clock = returnFocusTo.current;
		return () => {
			if (panel?.contains(document.activeElement)) clock?.focus();
		};
	}, [returnFocusTo]);

	// A key press moved the day: keep the keyboard on it once it has rendered.
	useEffect(() => {
		if (!focusAfterRender.current) return;
		focusAfterRender.current = false;
		gridRef.current?.querySelector<HTMLElement>(`[data-calendar-day="${cursorKey}"]`)?.focus();
	}, [cursorKey]);

	const move = (next: Date) => {
		focusAfterRender.current = true;
		setCursor(next);
	};

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		const step = MOVES[e.key];
		if (!step || e.altKey || e.ctrlKey || e.metaKey) return;
		e.preventDefault();
		move(step(cursor));
	};

	const { openApp } = useWindowActions();
	const { setIsCalendarOpen } = useShell();

	const handleOpenEvent = (eventId: string) => {
		setIsCalendarOpen(false);
		openApp('events', { section: 'detail', itemId: eventId });
	};

	return (
		<div ref={panelRef} className={styles.panel} data-calendar-panel="" role="dialog" aria-label={t('calendarTitle')} onKeyDown={onKeyDown}>
			<div className={styles.head}>
				<div className={styles.title} data-calendar-title="" aria-live="polite">
					{monthTitle(language, cursor.getFullYear(), cursor.getMonth())}
				</div>
				<button type="button" className={styles.nav} data-calendar-prev="" aria-label={t('calendarPrevMonth')} title={t('calendarPrevMonth')} onClick={() => setCursor(addMonths(cursor, -1))}>
					<ChevronLeft size={16} />
				</button>
				<button type="button" className={styles.todayBtn} data-calendar-today="" onClick={() => setCursor(today)}>
					{t('calendarToday')}
				</button>
				<button type="button" className={styles.nav} data-calendar-next="" aria-label={t('calendarNextMonth')} title={t('calendarNextMonth')} onClick={() => setCursor(addMonths(cursor, 1))}>
					<ChevronRight size={16} />
				</button>
			</div>

			<div ref={gridRef} className={styles.grid} role="group" aria-label={monthTitle(language, cursor.getFullYear(), cursor.getMonth())}>
				{weekdays.map((w, i) => (
					<div key={i} className={styles.weekday} data-calendar-weekday="">
						{w}
					</div>
				))}
				{cells.map((c) => {
					const isToday = c.key === todayKey;
					const count = byDay.get(c.key)?.length ?? 0;
					const classes = [styles.day, !c.inMonth && styles.outside, isToday && styles.today, c.key === cursorKey && styles.selected].filter(Boolean).join(' ');
					return (
						<button
							key={c.key}
							type="button"
							className={classes}
							tabIndex={c.key === cursorKey ? 0 : -1}
							data-calendar-day={c.key}
							data-today={isToday ? '' : undefined}
							data-outside={c.inMonth ? undefined : ''}
							data-has-event={count > 0 ? '' : undefined}
							aria-current={isToday ? 'date' : undefined}
							aria-pressed={c.key === cursorKey}
							aria-label={count > 0 ? `${dayLong(language, parseDayKey(c.key))}, ${fill(t('calendarEventCount'), { n: count })}` : dayLong(language, parseDayKey(c.key))}
							onClick={() => setCursor(parseDayKey(c.key))}
						>
							{c.day}
							{count > 0 && <span className={styles.dot} aria-hidden="true" />}
						</button>
					);
				})}
			</div>

			{showEvents && (
				<div className={styles.agenda} data-calendar-agenda="">
					<div className={styles.agendaDay}>{dayLong(language, cursor)}</div>
					{dayEvents.length === 0 ? (
						<div className={styles.empty}>{t('calendarNoEvents')}</div>
					) : (
						dayEvents.map((e) => (
							<div
								key={e.id}
								className={styles.agendaItem}
								data-calendar-event={e.id}
								onClick={() => handleOpenEvent(e.id)}
								style={{ cursor: 'pointer' }}
								role="button"
								tabIndex={0}
								onKeyDown={(ke) => {
									if (ke.key === 'Enter' || ke.key === ' ') {
										ke.preventDefault();
										handleOpenEvent(e.id);
									}
								}}
							>
								<span className={styles.agendaTime}>{formatTime(e.baslangic, language)}</span>
								<span className={styles.agendaTitle}>{e.baslik}</span>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}
