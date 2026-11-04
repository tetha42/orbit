'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { AUDIT_ACTIONS } from '@/lib/audit';
import ui from '@/core/ui/ui.module.css';
import s from './Roles.module.css';

export interface AuditQuery {
	user: string;
	role: string;
	action: string;
	from: string;
	to: string;
	page: number;
}

interface AuditFilterBarProps {
	filter: AuditQuery;
	userDraft: string;
	roles: { id: string; name: string }[];
	onPersonChange: (val: string) => void;
	onRoleChange: (val: string) => void;
	onActionChange: (val: string) => void;
	onFromChange: (val: string) => void;
	onToChange: (val: string) => void;
	onResetFilters: () => void;
}

const opKey = (action: string) => `auditOp_${action.replace(/\./g, '_')}`;

export function AuditFilterBar({
	filter,
	userDraft,
	roles,
	onPersonChange,
	onRoleChange,
	onActionChange,
	onFromChange,
	onToChange,
	onResetFilters,
}: AuditFilterBarProps) {
	const { t } = useI18n();
	const hasFilter = Boolean(filter.user || filter.role || filter.action || filter.from || filter.to);

	return (
		<div className={s.auditFilters}>
			<input
				className={ui.input}
				style={{ flex: '1 1 170px', minWidth: 140 }}
				placeholder={t('auditFiltreKisi')}
				value={userDraft}
				onChange={(e) => onPersonChange(e.target.value)}
				aria-label={t('auditFiltreKisi')}
			/>
			<select
				className={ui.select}
				style={{ flex: '0 1 150px', minWidth: 125 }}
				value={filter.role}
				onChange={(e) => onRoleChange(e.target.value)}
				aria-label={t('auditFiltreRol')}
			>
				<option value="">{t('auditFiltreRolHepsi')}</option>
				{roles.map((r) => (
					<option key={r.id} value={r.id}>
						{r.name}
					</option>
				))}
			</select>
			<select
				className={ui.select}
				style={{ flex: '0 1 170px', minWidth: 135 }}
				value={filter.action}
				onChange={(e) => onActionChange(e.target.value)}
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
					value={filter.from}
					onChange={(e) => onFromChange(e.target.value)}
					aria-label={t('auditFiltreBaslangic')}
					title={t('auditFiltreBaslangic')}
				/>
				<span className={s.dateSep}>—</span>
				<input
					type="date"
					className={ui.input}
					style={{ flex: '1 1 125px', minWidth: 105, maxWidth: 140 }}
					value={filter.to}
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
