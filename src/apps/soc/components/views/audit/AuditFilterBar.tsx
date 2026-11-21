'use client';

import React from 'react';
import { Search, X, Sliders, Shield } from 'lucide-react';
import { formatAuditAction } from '@/lib/audit';
import type { AuditCopy } from './i18nAudit';
import type { CategoryType, DatePresetType } from './auditUtils';
import s from '../SocAuditView.module.css';

interface AuditFilterBarProps {
	copy: AuditCopy;
	t: (key: string, fallback?: string) => string;
	searchQuery: string;
	onSearchChange: (val: string) => void;
	onClearSearch: () => void;
	activeCategory: CategoryType;
	onCategoryChange: (cat: CategoryType) => void;
	roles: { id: string; name: string }[];
	selectedRole: string;
	onRoleChange: (val: string) => void;
	availableActions: readonly string[];
	selectedAction: string;
	onActionChange: (val: string) => void;
	datePreset: DatePresetType;
	onDatePreset: (preset: DatePresetType) => void;
	fromDate: string;
	toDate: string;
	onFromDateChange: (val: string) => void;
	onToDateChange: (val: string) => void;
	hasActiveFilters: boolean;
	onResetFilters: () => void;
}

export function AuditFilterBar({
	copy,
	t,
	searchQuery,
	onSearchChange,
	onClearSearch,
	activeCategory,
	onCategoryChange,
	roles,
	selectedRole,
	onRoleChange,
	availableActions,
	selectedAction,
	onActionChange,
	datePreset,
	onDatePreset,
	fromDate,
	toDate,
	onFromDateChange,
	onToDateChange,
	hasActiveFilters,
	onResetFilters,
}: AuditFilterBarProps) {
	return (
		<div className={s.filterSection}>
			<div className={s.filterRowMain}>
				<div className={s.searchWrap}>
					<Search size={14} className={s.searchIcon} />
					<input
						type="text"
						className={s.searchInput}
						placeholder={copy.searchPlaceholder}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						aria-label={t('auditFilterActor')}
					/>
					{searchQuery && (
						<button
							type="button"
							className={s.clearSearchBtn}
							onClick={onClearSearch}
							title={copy.clearSearchTitle}
						>
							<X size={12} />
						</button>
					)}
				</div>

				<div className={s.categoryPills}>
					<button
						type="button"
						className={`${s.categoryBtn} ${activeCategory === 'all' ? s.categoryBtnActive : ''}`}
						onClick={() => onCategoryChange('all')}
					>
						{copy.catAll}
					</button>
					<button
						type="button"
						className={`${s.categoryBtn} ${activeCategory === 'roles' ? s.categoryBtnActive : ''}`}
						onClick={() => onCategoryChange('roles')}
					>
						<Sliders size={12} />
						<span>{copy.catRoles}</span>
					</button>
					<button
						type="button"
						className={`${s.categoryBtn} ${activeCategory === 'members' ? s.categoryBtnActive : ''}`}
						onClick={() => onCategoryChange('members')}
					>
						{copy.catMembers}
					</button>
					<button
						type="button"
						className={`${s.categoryBtn} ${activeCategory === 'security' ? s.categoryBtnActive : ''}`}
						onClick={() => onCategoryChange('security')}
					>
						<Shield size={12} />
						<span>{copy.catSecurity}</span>
					</button>
				</div>
			</div>

			<div className={s.filterRowSecondary}>
				<select
					className={s.selectInput}
					value={selectedRole}
					onChange={(e) => onRoleChange(e.target.value)}
					aria-label={t('auditFilterByRole')}
				>
					<option value="">{t('auditFilterRoleAll')}</option>
					{roles.map((r) => (
						<option key={r.id} value={r.id}>
							{r.name}
						</option>
					))}
				</select>

				<select
					className={s.selectInput}
					value={selectedAction}
					onChange={(e) => onActionChange(e.target.value)}
					aria-label={t('auditFilterAction')}
				>
					<option value="">{t('auditFilterActionAll')}</option>
					{availableActions.map((op) => (
						<option key={op} value={op}>
							{formatAuditAction(op, t)}
						</option>
					))}
				</select>

				<div className={s.datePresetGroup}>
					{(
						[
							['all', copy.dateAll],
							['today', copy.dateToday],
							['7d', copy.date7d],
							['30d', copy.date30d],
						] as const
					).map(([preset, label]) => (
						<button
							key={preset}
							type="button"
							className={`${s.datePresetBtn} ${datePreset === preset ? s.datePresetBtnActive : ''}`}
							onClick={() => onDatePreset(preset)}
						>
							{label}
						</button>
					))}
				</div>

				<div className={s.dateRangeCustom}>
					<input
						type="date"
						className={s.dateInput}
						value={fromDate}
						onChange={(e) => onFromDateChange(e.target.value)}
						aria-label={t('auditFilterStart')}
						title={t('auditFilterStart')}
					/>
					<span className={s.dateSep}>—</span>
					<input
						type="date"
						className={s.dateInput}
						value={toDate}
						onChange={(e) => onToDateChange(e.target.value)}
						aria-label={t('auditFilterEnd')}
						title={t('auditFilterEnd')}
					/>
				</div>

				{hasActiveFilters && (
					<button
						type="button"
						className={s.resetFilterBtn}
						onClick={onResetFilters}
						title={t('auditFilterClear')}
					>
						<X size={12} />
						<span>{t('auditFilterClear')}</span>
					</button>
				)}
			</div>
		</div>
	);
}
