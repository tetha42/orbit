'use client';

import React from 'react';
import { Clock, X } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime } from '../../../types';
import type { TimeRangePreset, SiemSearchField, SiemSearchOp, SiemFilterSnapshot } from '../../../types';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../SocSiem.module.css';

interface SiemActiveChipsProps {
	siemTimeRange: TimeRangePreset;
	siemStartTime: number | null;
	siemService: string;
	setSiemService: (val: string) => void;
	siemServiceOp: 'eq' | 'neq';
	setSiemServiceOp: (val: 'eq' | 'neq') => void;
	siemLevel: string;
	setSiemLevel: (val: string) => void;
	siemLevelOp: 'eq' | 'neq';
	setSiemLevelOp: (val: 'eq' | 'neq') => void;
	siemIp: string;
	setSiemIp: (val: string) => void;
	siemIpOp: 'eq' | 'neq' | 'contains' | 'not_contains';
	setSiemIpOp: (val: 'eq' | 'neq' | 'contains' | 'not_contains') => void;
	siemSearch: string;
	setSiemSearch: (val: string) => void;
	siemSearchField: SiemSearchField;
	siemSearchOp: SiemSearchOp;
	language: Language;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onSelectTimeRange: (preset: TimeRangePreset) => void;
	onFetch: (overrides?: Partial<SiemFilterSnapshot>) => Promise<void>;
}

export function SiemActiveChips({
	siemTimeRange,
	siemStartTime,
	siemService,
	setSiemService,
	siemServiceOp,
	setSiemServiceOp,
	siemLevel,
	setSiemLevel,
	siemLevelOp,
	setSiemLevelOp,
	siemIp,
	setSiemIp,
	siemIpOp,
	setSiemIpOp,
	siemSearch,
	setSiemSearch,
	siemSearchField,
	siemSearchOp,
	language,
	copy,
	onSelectTimeRange,
	onFetch,
}: SiemActiveChipsProps) {
	const hasAny =
		siemService !== 'all' ||
		siemLevel !== 'all' ||
		siemIp.trim() ||
		siemSearch.trim() ||
		siemTimeRange !== '24h' ||
		siemStartTime !== null;

	if (!hasAny) return null;

	return (
		<div className={s.excelChipsBar}>
			<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
				{copy.activeFiltersLabel}
			</span>

			{(siemTimeRange !== '24h' || siemStartTime !== null) && (
				<span className={s.excelChip}>
					<Clock size={11} />
					{copy.windowPrefix} {siemTimeRange}
					{siemStartTime ? ` (${formatDateTime(siemStartTime, language)})` : ''}
					<button
						type="button"
						className={s.excelChipClose}
						onClick={() => onSelectTimeRange('24h')}
						title={copy.resetTo24hTitle}
					>
						<X size={12} />
					</button>
				</span>
			)}

			{siemService !== 'all' && (
				<span className={`${s.excelChip} ${siemServiceOp === 'neq' ? s.excelChipNeg : ''}`}>
					{copy.serviceLabel} {siemServiceOp === 'neq' ? '≠' : '='} {siemService}
					<button
						type="button"
						className={s.excelChipClose}
						onClick={() => {
							setSiemService('all');
							setSiemServiceOp('eq');
							void onFetch({ service: 'all', serviceOp: 'eq' });
						}}
					>
						<X size={12} />
					</button>
				</span>
			)}

			{siemLevel !== 'all' && (
				<span className={`${s.excelChip} ${siemLevelOp === 'neq' ? s.excelChipNeg : ''}`}>
					{copy.severityLabel} {siemLevelOp === 'neq' ? '≠' : '='} {siemLevel}
					<button
						type="button"
						className={s.excelChipClose}
						onClick={() => {
							setSiemLevel('all');
							setSiemLevelOp('eq');
							void onFetch({ level: 'all', levelOp: 'eq' });
						}}
					>
						<X size={12} />
					</button>
				</span>
			)}

			{siemIp.trim() && (
				<span className={`${s.excelChip} ${siemIpOp === 'neq' ? s.excelChipNeg : ''}`}>
					IP {siemIpOp === 'neq' ? '≠' : '='} {siemIp}
					<button
						type="button"
						className={s.excelChipClose}
						onClick={() => {
							setSiemIp('');
							setSiemIpOp('eq');
							void onFetch({ ip: '', ipOp: 'eq' });
						}}
					>
						<X size={12} />
					</button>
				</span>
			)}

			{siemSearch.trim() && (
				<span
					className={`${s.excelChip} ${
						siemSearchOp === 'not_contains' || siemSearchOp === 'not_equals' ? s.excelChipNeg : ''
					}`}
				>
					{siemSearchField}: &quot;{siemSearch}&quot;
					<button
						type="button"
						className={s.excelChipClose}
						onClick={() => {
							setSiemSearch('');
							void onFetch({ search: '' });
						}}
					>
						<X size={12} />
					</button>
				</span>
			)}
		</div>
	);
}
