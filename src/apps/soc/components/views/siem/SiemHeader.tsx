'use client';

import React from 'react';
import { FileSearch, Activity, Download, Radio } from 'lucide-react';
import { fill } from '@/lib/text';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../Soc.module.css';
import siem from '../../../SocSiem.module.css';

interface SiemHeaderProps {
	eventsCount: number;
	liveTail: boolean;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onExport: (format: 'csv' | 'json') => void;
	onToggleLiveTail: () => void;
}

export function SiemHeader({
	eventsCount,
	liveTail,
	copy,
	onExport,
	onToggleLiveTail,
}: SiemHeaderProps) {
	return (
		<div className={s.cardHeader}>
			<div>
				<h2 className={s.cardTitle}>
					<FileSearch size={16} />
					<span>{copy.title}</span>
				</h2>
				<p className={s.cardSub}>{copy.subtitle}</p>
			</div>

			<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
				<span className={siem.siemCountBadge}>
					<Activity size={12} />
					<span>{fill(copy.eventsCount, { count: eventsCount })}</span>
				</span>

				<div className={siem.segmentedBtnGroup}>
					<button
						type="button"
						onClick={() => onExport('csv')}
						className={siem.segmentedBtn}
						title={copy.exportCsvTitle}
					>
						<Download size={12} />
						CSV
					</button>
					<button
						type="button"
						onClick={() => onExport('json')}
						className={siem.segmentedBtn}
						title={copy.exportJsonTitle}
					>
						JSON
					</button>
				</div>

				<button
					type="button"
					onClick={onToggleLiveTail}
					className={`${s.actionBtn} ${liveTail ? s.actionBtnSuccess : ''}`}
					style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
					title={copy.liveTailTitle}
				>
					{liveTail ? (
						<>
							<span className={siem.pulseDot} />
							<span>{copy.liveTailActive}</span>
						</>
					) : (
						<>
							<Radio size={13} />
							<span>{copy.liveTailIdle}</span>
						</>
					)}
				</button>
			</div>
		</div>
	);
}
