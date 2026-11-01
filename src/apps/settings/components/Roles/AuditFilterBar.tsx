'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { AUDIT_ACTIONS } from '@/lib/audit';
import ui from '@/core/ui/ui.module.css';
import s from './Roles.module.css';

export interface Suzgec {
	kisi: string;
	role: string;
	islem: string;
	from: string;
	to: string;
	sayfa: number;
}

interface AuditFilterBarProps {
	filtre: Suzgec;
	kisiYazilan: string;
	roller: { id: string; ad: string }[];
	onKisiChange: (val: string) => void;
	onRolChange: (val: string) => void;
	onIslemChange: (val: string) => void;
	onFromChange: (val: string) => void;
	onToChange: (val: string) => void;
	onResetFilters: () => void;
}

const opKey = (islem: string) => `auditOp_${islem.replace(/\./g, '_')}`;

export function AuditFilterBar({
	filtre,
	kisiYazilan,
	roller,
	onKisiChange,
	onRolChange,
	onIslemChange,
	onFromChange,
	onToChange,
	onResetFilters,
}: AuditFilterBarProps) {
	const { t } = useI18n();
	const hasFilter = Boolean(filtre.kisi || filtre.role || filtre.islem || filtre.from || filtre.to);

	return (
		<div className={s.auditFilters}>
			<input
				className={ui.input}
				style={{ flex: '1 1 170px', minWidth: 140 }}
				placeholder={t('auditFiltreKisi')}
				value={kisiYazilan}
				onChange={(e) => onKisiChange(e.target.value)}
				aria-label={t('auditFiltreKisi')}
			/>
			<select
				className={ui.select}
				style={{ flex: '0 1 150px', minWidth: 125 }}
				value={filtre.role}
				onChange={(e) => onRolChange(e.target.value)}
				aria-label={t('auditFiltreRol')}
			>
				<option value="">{t('auditFiltreRolHepsi')}</option>
				{roller.map((r) => (
					<option key={r.id} value={r.id}>
						{r.ad}
					</option>
				))}
			</select>
			<select
				className={ui.select}
				style={{ flex: '0 1 170px', minWidth: 135 }}
				value={filtre.islem}
				onChange={(e) => onIslemChange(e.target.value)}
				aria-label={t('auditFiltreIslem')}
			>
				<option value="">{t('auditFiltreIslemHepsi')}</option>
				{AUDIT_ACTIONS.map((op) => (
					<option key={op} value={op}>
						{t(opKey(op))}
					</option>
				))}
			</select>
			<div className={s.dateRangeGroup}>
				<input
					type="date"
					className={ui.input}
					style={{ flex: '1 1 125px', minWidth: 105, maxWidth: 140 }}
					value={filtre.from}
					onChange={(e) => onFromChange(e.target.value)}
					aria-label={t('auditFiltreBaslangic')}
					title={t('auditFiltreBaslangic')}
				/>
				<span className={s.dateSep}>—</span>
				<input
					type="date"
					className={ui.input}
					style={{ flex: '1 1 125px', minWidth: 105, maxWidth: 140 }}
					value={filtre.to}
					onChange={(e) => onToChange(e.target.value)}
					aria-label={t('auditFiltreBitis')}
					title={t('auditFiltreBitis')}
				/>
			</div>

			{hasFilter && (
				<button type="button" className={ui.btn} onClick={onResetFilters} title={t('auditFiltreTemizle')}>
					<X size={13} /> {t('auditFiltreTemizle')}
				</button>
			)}
		</div>
	);
}
