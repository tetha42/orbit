'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime } from '../../../types';
import type { HistogramBucket } from '../../../types';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../SocSiem.module.css';

interface SiemHistogramProps {
	siemHistogram: HistogramBucket[];
	selectedBucket: number | null;
	language: Language;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onZoomBucket: (bucket: HistogramBucket) => void;
}

export function SiemHistogram({
	siemHistogram,
	selectedBucket,
	language,
	copy,
	onZoomBucket,
}: SiemHistogramProps) {
	if (siemHistogram.length === 0) return null;

	const maxCount = Math.max(1, ...siemHistogram.map((b) => b.count));

	return (
		<div className={s.siemHistogramCard}>
			<div className={s.siemHistogramHeader}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<Activity size={13} color="var(--accent)" />
					<span style={{ fontWeight: 600 }}>{copy.histogramTitle}</span>
					<span style={{ opacity: 0.6, fontSize: 11 }}>
						({siemHistogram.length} {copy.bucketsUnit})
					</span>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
						<span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--danger)' }} />
						CRITICAL
					</span>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
						<span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warning)' }} />
						ERROR
					</span>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
						<span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warning)' }} />
						WARN
					</span>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
						<span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cyan)' }} />
						INFO
					</span>
				</div>
			</div>

			<div className={s.siemHistogramBars}>
				{siemHistogram.map((b, idx) => {
					const isSelected = selectedBucket === b.start;
					const totalHeightPct = Math.max(6, Math.round((b.count / maxCount) * 100));
					const critPct = b.count > 0 ? (b.critical / b.count) * 100 : 0;
					const errPct = b.count > 0 ? (b.error / b.count) * 100 : 0;
					const warnPct = b.count > 0 ? (b.warn / b.count) * 100 : 0;
					const infoPct = b.count > 0 ? (b.info / b.count) * 100 : 0;

					return (
						<div
							key={idx}
							className={`${s.siemHistogramCol} ${isSelected ? s.siemHistogramColActive : ''}`}
							onClick={() => onZoomBucket(b)}
							title={`${formatDateTime(b.start, language)}: ${b.count} ${copy.eventsUnit} (${b.critical} crit, ${b.error} err, ${b.warn} warn, ${b.info} info)`}
						>
							<div className={s.siemHistogramBar} style={{ height: `${totalHeightPct}%` }}>
								{critPct > 0 && <div className={s.siemHistogramSegCritical} style={{ height: `${critPct}%` }} />}
								{errPct > 0 && <div className={s.siemHistogramSegError} style={{ height: `${errPct}%` }} />}
								{warnPct > 0 && <div className={s.siemHistogramSegWarn} style={{ height: `${warnPct}%` }} />}
								{infoPct > 0 && <div className={s.siemHistogramSegInfo} style={{ height: `${infoPct}%` }} />}
							</div>
							{idx % Math.max(1, Math.floor(siemHistogram.length / 6)) === 0 && (
								<span className={s.siemHistogramColLabel}>
									{new Date(b.start).toLocaleTimeString(language, {
										hour: '2-digit',
										minute: '2-digit',
									})}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
