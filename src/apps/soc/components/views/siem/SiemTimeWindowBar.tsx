'use client';

import React from 'react';
import { Clock, Calendar, RotateCcw } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime } from '../../../types';
import type { TimeRangePreset } from '../../../types';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../SocSiem.module.css';

interface SiemTimeWindowBarProps {
	siemTimeRange: TimeRangePreset;
	siemStartTime: number | null;
	siemEndTime: number | null;
	selectedBucket: number | null;
	language: Language;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onSelectTimeRange: (preset: TimeRangePreset) => void;
	onOpenCustomModal: () => void;
}

export function SiemTimeWindowBar({
	siemTimeRange,
	siemStartTime,
	siemEndTime,
	selectedBucket,
	language,
	copy,
	onSelectTimeRange,
	onOpenCustomModal,
}: SiemTimeWindowBarProps) {
	const presets: Array<{ id: TimeRangePreset; label: string }> = [
		{ id: '15m', label: copy.preset15m },
		{ id: '1h', label: copy.preset1h },
		{ id: '6h', label: copy.preset6h },
		{ id: '24h', label: copy.preset24h },
		{ id: '7d', label: copy.preset7d },
		{ id: 'all', label: copy.presetAll },
	];

	return (
		<div className={s.siemTimeRangeBar}>
			<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>
				<Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
				{copy.timeWindowLabel}
			</span>
			{presets.map((preset) => {
				const isActive = siemTimeRange === preset.id && !siemStartTime;
				return (
					<button
						key={preset.id}
						type="button"
						className={`${s.siemTimeRangeBtn} ${isActive ? s.siemTimeRangeBtnActive : ''}`}
						onClick={() => onSelectTimeRange(preset.id)}
					>
						{preset.label}
					</button>
				);
			})}

			<button
				type="button"
				className={`${s.siemTimeRangeBtn} ${siemTimeRange === 'custom' ? s.siemTimeRangeBtnActive : ''}`}
				onClick={onOpenCustomModal}
				title={copy.customRangeTitle}
			>
				<Calendar size={12} />
				<span>
					{siemStartTime && siemEndTime
						? `${formatDateTime(siemStartTime, language)} – ${formatDateTime(siemEndTime, language)}`
						: copy.customRangeBtn}
				</span>
			</button>

			{selectedBucket && (
				<button
					type="button"
					className={`${s.siemTimeRangeBtn} ${s.siemTimeRangeBtnActive}`}
					onClick={() => onSelectTimeRange('24h')}
					title={copy.clearZoomTitle}
					style={{ background: 'var(--warning)', color: '#ffffff' }}
				>
					<RotateCcw size={11} />
					<span>{copy.resetZoomBtn}</span>
				</button>
			)}
		</div>
	);
}
