'use client';

import React from 'react';
import { CheckCircle2, Clock, Info, MapPin, Ticket, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { Linkified } from '@/components/Common/Linkified';
import { fill } from '@/lib/text';
import { formatRange } from '@/components/Events/eventsShared';
import type { EventView } from '../../types';
import s from '../../EventsMobile.module.css';

interface EventMobileDetailBodyProps {
	event: EventView;
	locale: string;
	now: number;
	live: boolean;
	ended: boolean;
	full: boolean;
	typeKey: string;
	onOpenTicket: (e: EventView) => void;
}

export function EventMobileDetailBody({
	event: e,
	locale,
	now,
	live,
	ended,
	full,
	typeKey,
	onOpenTicket,
}: EventMobileDetailBodyProps) {
	const { t } = useI18n();

	return (
		<div className={s.detailScroll}>
			<div className={s.heroCard}>
				<div className={s.cardBadgeRow}>
					<span className={s.typeBadge}>{t(typeKey)}</span>
					{live && <span className={s.liveBadge}>{t('evLive')}</span>}
					{e.status === 'draft' && (
						<span className={s.typeBadge} style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#fff' }}>
							{t('evDraft')}
						</span>
					)}
					{e.status === 'cancelled' && (
						<span className={s.typeBadge} style={{ background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' }}>
							{t('evCancelled')}
						</span>
					)}
					{e.myAttendance ? (
						<span
							className={s.typeBadge}
							style={{
								background: 'color-mix(in srgb, var(--success) 15%, transparent)',
								color: 'var(--success)',
								display: 'inline-flex',
								alignItems: 'center',
								gap: 4,
							}}
						>
							<CheckCircle2 size={11} /> {t('evAttended')}
						</span>
					) : e.myRecord ? (
						<span className={s.typeBadge} style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
							{t('evRegistered')}
						</span>
					) : null}
				</div>
				<h1 className={s.detailTitle}>{e.title}</h1>
			</div>

			<div className={s.factsGroup}>
				<div className={s.factRow}>
					<div className={s.factIconCircle}>
						<Clock size={16} />
					</div>
					<div className={s.factTexts}>
						<span className={s.factLabel}>{t('evWhen')}</span>
						<span className={s.factValue}>{formatRange(e.start, e.endTime, locale)}</span>
					</div>
				</div>

				<div className={s.factRow}>
					<div className={s.factIconCircle}>
						<MapPin size={16} />
					</div>
					<div className={s.factTexts}>
						<span className={s.factLabel}>{t('evWhere')}</span>
						<span className={s.factValue}>{e.location}</span>
					</div>
				</div>

				<div className={s.factRow}>
					<div className={s.factIconCircle}>
						<Users size={16} />
					</div>
					<div className={s.factTexts}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span className={s.factLabel}>{t('evCapacity')}</span>
							<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
								{e.capacity > 0 ? `${e.registeredCount} / ${e.capacity}` : `${e.registeredCount} · ${t('evUnlimited')}`}
							</span>
						</div>

						{e.capacity > 0 && (
							<div className={s.meterBar}>
								<div className={s.meterFill} style={{ width: `${Math.min(100, (e.registeredCount / e.capacity) * 100)}%` }} />
							</div>
						)}

						<span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
							{ended || live
								? fill(t('evAttendedCount'), { n: e.participantCount })
								: full
								? t('evFull')
								: e.capacity > 0
								? fill(t('evSeatsLeft'), { n: e.capacity - e.registeredCount })
								: ''}
						</span>
					</div>
				</div>
			</div>

			{e.myAttendance && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						padding: '10px 14px',
						borderRadius: 14,
						background: 'color-mix(in srgb, var(--success) 12%, transparent)',
						border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
						color: 'var(--success)',
						fontSize: 12.5,
						fontWeight: 600,
					}}
				>
					<CheckCircle2 size={16} />
					<span>
						{fill(t('evAttendedAt'), {
							when: new Date(e.myAttendance.participationTime).toLocaleString(locale, {
								hour: '2-digit',
								minute: '2-digit',
								day: 'numeric',
								month: 'short',
							}),
						})}
					</span>
				</div>
			)}

			{e.myRecord && e.ticketCode && (
				<div className={s.ticketCard}>
					<div className={s.ticketLeft}>
						<Ticket size={24} color="var(--accent)" />
						<div>
							<div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t('evMyTicket')}</div>
							<div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{e.ticketCode}</div>
						</div>
					</div>
					<button type="button" className={s.ticketBtn} onClick={() => onOpenTicket(e)}>
						{t('evMyTicket')}
					</button>
				</div>
			)}

			{e.myRecord && e.start <= now && !ended && e.status === 'published' && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						padding: '8px 12px',
						borderRadius: 12,
						background: 'rgba(255, 255, 255, 0.05)',
						border: '1px solid var(--border-subtle)',
						color: 'var(--text-muted)',
						fontSize: 12,
					}}
				>
					<Info size={14} style={{ flexShrink: 0 }} />
					<span>{t('evRegistrationLockedStarted')}</span>
				</div>
			)}

			{e.description && (
				<div className={s.aboutCard}>
					<div className={s.aboutTitle}>{t('evAbout')}</div>
					<div className={s.aboutText}>
						<Linkified text={e.description} />
					</div>
				</div>
			)}
		</div>
	);
}
