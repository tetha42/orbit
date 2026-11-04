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
		const updateTime = () => {
			const now = new Date();
			const localeDef = getLocaleDefinition(language);
			const formatted = new Intl.DateTimeFormat(localeDef.dateLocale, {
				weekday: 'short',
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
			}).format(now);
			setTimeStr(formatted);
		};

		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	}, [language]);

	// Close on click outside
	useEffect(() => {
		const handlePointerDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsCalendarOpen(false);
			}
		};
		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [setIsCalendarOpen]);

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
