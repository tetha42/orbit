'use client';

import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import s from './SocModals.module.css';

export const CustomDateModal = React.memo(function CustomDateModal() {
	const {
		showCustomDateModal,
		setShowCustomDateModal,
		customDateStart,
		setCustomDateStart,
		customDateEnd,
		setCustomDateEnd,
		handleApplyCustomDate,
		isEn,
	} = useSoc();

	if (!showCustomDateModal) return null;

	return (
		<div className={s.backdrop} onClick={() => setShowCustomDateModal(false)}>
			<div className={s.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
				<div className={s.modalHeader}>
					<div className={s.modalHeaderTitle}>
						<Calendar size={16} />
						<span>{isEn ? 'Forensic Custom Time Window' : 'Özel Adli Zaman Penceresi'}</span>
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
						{isEn
							? 'Specify precise start and end timestamps for deep incident investigation and correlation.'
							: 'AppEvent korelasyonu ve derinlemesine adli analiz için başlangıç ve bitiş zaman damgalarını belirleyin.'}
					</p>

					<div className={s.formField}>
						<label>{isEn ? 'Start Time' : 'Başlangıç Zamanı'}</label>
						<input
							type="datetime-local"
							className={s.input}
							value={customDateStart}
							onChange={(e) => setCustomDateStart(e.target.value)}
						/>
					</div>

					<div className={s.formField}>
						<label>{isEn ? 'End Time' : 'Bitiş Zamanı'}</label>
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
							onClick={() => {
								const now = Date.now();
								const d = new Date(now - 12 * 3600 * 1000);
								setCustomDateStart(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
								setCustomDateEnd(new Date(now - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
							}}
						>
							{isEn ? 'Last 12 Hours' : 'Son 12 Saat'}
						</button>
						<button
							type="button"
							className={s.btn}
							style={{ fontSize: 11, height: 26, padding: '0 8px' }}
							onClick={() => {
								const now = Date.now();
								const d = new Date(now - 3 * 86400 * 1000);
								setCustomDateStart(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
								setCustomDateEnd(new Date(now - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
							}}
						>
							{isEn ? 'Last 3 Days' : 'Son 3 Gün'}
						</button>
						<button
							type="button"
							className={s.btn}
							style={{ fontSize: 11, height: 26, padding: '0 8px' }}
							onClick={() => {
								const now = Date.now();
								const d = new Date(now - 30 * 86400 * 1000);
								setCustomDateStart(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
								setCustomDateEnd(new Date(now - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
							}}
						>
							{isEn ? 'Last 30 Days' : 'Son 30 Gün'}
						</button>
					</div>
				</div>

				<div className={s.modalFooter}>
					<button
						type="button"
						className={s.btn}
						onClick={() => setShowCustomDateModal(false)}
					>
						{isEn ? 'Cancel' : 'İptal'}
					</button>
					<button
						type="button"
						className={`${s.btn} ${s.btnPrimary}`}
						onClick={handleApplyCustomDate}
					>
						{isEn ? 'Apply Range' : 'Aralığı Uygula'}
					</button>
				</div>
			</div>
		</div>
	);
});
