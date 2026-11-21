'use client';

import { useState, useEffect, useRef } from 'react';
import { getLocaleDefinition, useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { CalendarPanel } from './CalendarPanel';

export function ClockApplet() {
	const { language, t } = useI18n();
	const { isCalendarOpen, setIsCalendarOpen } = useShell();
	const [timeStr, setTimeStr] = useState('');

	const ref = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const localeDef = getLocaleDefinition(language);
		const formatter = new Intl.DateTimeFormat(localeDef.dateLocale, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
		});

		const updateTime = () => {
			if (typeof document !== 'undefined' && document.hidden) return;
			setTimeStr(formatter.format(new Date()));
		};

		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const scheduleNextTick = () => {
			if (timeoutId) clearTimeout(timeoutId);
			const now = new Date();
			const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
			timeoutId = setTimeout(() => {
				updateTime();
				scheduleNextTick();
			}, Math.max(1000, msUntilNextMinute));
		};

		updateTime();
		scheduleNextTick();
		const onVisibility = () => {
			if (typeof document !== 'undefined' && !document.hidden) {
				updateTime();
				scheduleNextTick();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			if (timeoutId) clearTimeout(timeoutId);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [language]);

	// Close on click outside (only attach when open)
	useEffect(() => {
		if (!isCalendarOpen) return;
		const handlePointerDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsCalendarOpen(false);
			}
		};
		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [isCalendarOpen, setIsCalendarOpen]);

	return (
		<div ref={ref} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
			<button
				ref={buttonRef}
				type="button"
				data-clock-toggle=""
				aria-expanded={isCalendarOpen}
				aria-haspopup="dialog"
				title={t('calendarOpen')}
				onClick={() => setIsCalendarOpen(!isCalendarOpen)}
				style={{
					padding: '2px 8px',
					borderRadius: '4px',
					fontSize: '13px',
					fontWeight: 500,
					cursor: 'default',
					letterSpacing: '0.02em',
					color: 'inherit',
					background: isCalendarOpen ? 'var(--fill-strong)' : 'transparent',
					border: 'none',
				}}
			>
				{timeStr || t('clockFallbackTime', 'Mon Sep 28 9:00 AM')}
			</button>

			{isCalendarOpen && <CalendarPanel returnFocusTo={buttonRef} />}
		</div>
	);
}
