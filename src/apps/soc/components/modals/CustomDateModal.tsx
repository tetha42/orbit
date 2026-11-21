'use client';

import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import socContract from '../../soc.contract.json';
import { useSoc } from '../../context/SocContext';
import { MODALS_I18N } from './i18nModals';
import s from './SocModals.module.css';

function toLocalInputValue(ms: number): string {
	const d = new Date(ms);
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export const CustomDateModal = React.memo(function CustomDateModal() {
	const {
		showCustomDateModal,
		setShowCustomDateModal,
		customDateStart,
		setCustomDateStart,
		customDateEnd,
		setCustomDateEnd,
		handleApplyCustomDate,
	} = useSoc();
	const { language } = useI18n();
	const copy = MODALS_I18N[language] ?? MODALS_I18N.en;

	if (!showCustomDateModal) return null;

	const maxWindowHours = socContract.limits.maxSiemQueryWindowHours;
	const startMs = customDateStart ? new Date(customDateStart).getTime() : NaN;
	const endMs = customDateEnd ? new Date(customDateEnd).getTime() : NaN;
	const exceedsContractWindow =
		Number.isFinite(startMs) &&
		Number.isFinite(endMs) &&
		(endMs - startMs) / 3600000 > maxWindowHours;

	const applyPresetHours = (hours: number) => {
		const now = Date.now();
		setCustomDateStart(toLocalInputValue(now - hours * 3600 * 1000));
		setCustomDateEnd(toLocalInputValue(now));
	};

	return (
		<div className={s.backdrop} onClick={() => setShowCustomDateModal(false)}>
			<div className={s.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
				<div className={s.modalHeader}>
					<div className={s.modalHeaderTitle}>
						<Calendar size={16} />
						<span>{copy.customDateTitle}</span>
					</div>
					<button
						type="button"
						className={s.closeBtn}
						onClick={() => setShowCustomDateModal(false)}
					>
						<X size={14} />
					</button>
				</div>

				<div className={s.modalBody}>
					<p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
						{copy.customDateDesc}
					</p>

					<div className={s.formField}>
						<label>{copy.customDateStart}</label>
						<input
							type="datetime-local"
							className={s.input}
							value={customDateStart}
							onChange={(e) => setCustomDateStart(e.target.value)}
						/>
					</div>

					<div className={s.formField}>
						<label>{copy.customDateEnd}</label>
						<input
							type="datetime-local"
							className={s.input}
							value={customDateEnd}
							onChange={(e) => setCustomDateEnd(e.target.value)}
						/>
					</div>

					<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
						<button
							type="button"
							className={s.btn}
							style={{ fontSize: 11, height: 26, padding: '0 8px' }}
							onClick={() => applyPresetHours(12)}
						>
							{copy.customDateLast12h}
						</button>
						<button
							type="button"
							className={s.btn}
							style={{ fontSize: 11, height: 26, padding: '0 8px' }}
							onClick={() => applyPresetHours(3 * 24)}
						>
							{copy.customDateLast3d}
						</button>
						<button
							type="button"
							className={s.btn}
							style={{ fontSize: 11, height: 26, padding: '0 8px' }}
							onClick={() => applyPresetHours(30 * 24)}
						>
							{copy.customDateLast30d}
						</button>
					</div>

					{exceedsContractWindow && (
						<div style={{ fontSize: 11.5, color: 'var(--danger)' }}>
							{fill(copy.customDateWindowExceeded, { hours: maxWindowHours })}
						</div>
					)}
				</div>

				<div className={s.modalFooter}>
					<button
						type="button"
						className={s.btn}
						onClick={() => setShowCustomDateModal(false)}
					>
						{copy.customDateCancel}
					</button>
					<button
						type="button"
						className={`${s.btn} ${s.btnPrimary}`}
						onClick={handleApplyCustomDate}
						disabled={exceedsContractWindow}
					>
						{copy.customDateApply}
					</button>
				</div>
			</div>
		</div>
	);
});
