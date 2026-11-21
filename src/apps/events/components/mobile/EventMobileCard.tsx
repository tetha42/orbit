'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { isLive, typeMeta } from '@/components/Events/eventsShared';
import type { EventView } from '../../types';
import s from '../../EventsMobile.module.css';

interface EventMobileCardProps {
	event: EventView;
	locale: string;
	now: number;
	onSelect: () => void;
}

export function EventMobileCard({ event: e, locale, now, onSelect }: EventMobileCardProps) {
	const { t } = useI18n();
	const meta = typeMeta(e.typeValue);
	const live = isLive(e, now);
	const day = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: 'numeric' });
	const month = (ms: number) => new Date(ms).toLocaleDateString(locale, { month: 'short' });
	const weekday = (ms: number) => new Date(ms).toLocaleDateString(locale, { weekday: 'short' });

	return (
		<div
			className={s.eventCard}
			style={{ '--type-color': meta.color } as React.CSSProperties}
			onClick={onSelect}
		>
			<div className={s.calendarLeaf}>
				<div className={s.calendarLeafMonth}>{month(e.start)}</div>
				<div className={s.calendarLeafDay}>{day(e.start)}</div>
				<div className={s.calendarLeafWeekday}>{weekday(e.start)}</div>
			</div>

			<div className={s.cardContent}>
				<div className={s.cardBadgeRow}>
					<span className={s.typeBadge}>{t(meta.key)}</span>
					{live && <span className={s.liveBadge}>{t('evLive')}</span>}
				</div>
				<div className={s.cardTitle}>{e.title}</div>
				<div className={s.cardSubtitle}>
					<span>📍</span>
					<span>{e.location}</span>
				</div>
			</div>

			<div className={s.cardStatusCol}>
				{e.myAttendance ? (
					<span className={`${s.statusPill} ${s.attendedPill}`}>{t('evAttended')}</span>
				) : e.myRecord ? (
					<span className={s.statusPill}>{t('evRegistered')}</span>
				) : e.capacity > 0 ? (
					<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
						{e.registeredCount}/{e.capacity}
					</span>
				) : null}
				<ChevronRight size={16} color="var(--text-muted)" style={{ opacity: 0.6 }} />
			</div>
		</div>
	);
}
