'use client';

import React from 'react';
import { Clock, MapPin, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { formatRange } from '@/components/Events/eventsShared';
import styles from '@/components/Events/Events.module.css';
import type { EventView } from '../types';

interface EventDetailFactsProps {
	event: EventView;
	locale: string;
	live: boolean;
	ended: boolean;
	full: boolean;
}

export function EventDetailFacts({ event: e, locale, live, ended, full }: EventDetailFactsProps) {
	const { t } = useI18n();

	return (
		<div className={styles.facts}>
			<div className={styles.fact}>
				<span className={styles.factIcon}>
					<Clock size={15} />
				</span>
				<div>
					<div className={styles.factLabel}>{t('evWhen')}</div>
					<div className={styles.factValue}>{formatRange(e.start, e.endTime, locale)}</div>
				</div>
			</div>
			<div className={styles.fact}>
				<span className={styles.factIcon}>
					<MapPin size={15} />
				</span>
				<div>
					<div className={styles.factLabel}>{t('evWhere')}</div>
					<div className={styles.factValue}>{e.location}</div>
				</div>
			</div>
			<div className={styles.fact}>
				<span className={styles.factIcon}>
					<Users size={15} />
				</span>
				<div style={{ flex: 1 }}>
					<div className={styles.factLabel}>{t('evCapacity')}</div>
					<div className={styles.factValue}>
						{e.capacity > 0 ? `${e.registeredCount} / ${e.capacity}` : `${e.registeredCount} · ${t('evUnlimited')}`}
					</div>
					{e.capacity > 0 && (
						<div className={styles.meter}>
							<span style={{ width: `${Math.min(100, (e.registeredCount / e.capacity) * 100)}%` }} />
						</div>
					)}
					<div className={styles.factLabel} style={{ marginTop: 4 }}>
						{ended || live
							? fill(t('evAttendedCount'), { n: e.participantCount })
							: full
							? t('evFull')
							: e.capacity > 0
							? fill(t('evSeatsLeft'), { n: e.capacity - e.registeredCount })
							: ''}
					</div>
				</div>
			</div>
		</div>
	);
}
