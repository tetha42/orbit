'use client';

import React from 'react';
import { Search, RefreshCw, UserPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import { optionLabel, type FormFieldOption } from '@/lib/formFields';

interface MembersToolbarProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	selectedDepartment: string;
	onDeptChange: (dept: string) => void;
	selectedGrade: number;
	onClassChange: (c: number) => void;
	trackOptions: FormFieldOption[];
	levelOptions: FormFieldOption[];
	roleFilter: string;
	onRolFilterChange: (role: string) => void;
	roleOptions: [string, string][];
	hasRolelessMember: boolean;
	activeFilter: 'all' | 'aktif' | 'beklemede' | 'mezun';
	onActiveFilterChange: (filter: 'all' | 'aktif' | 'beklemede' | 'mezun') => void;
	totalMembersCount: number;
	isAuthorizedToAdd: boolean;
	isLoading: boolean;
	onRefresh: () => void;
	onOpenAdd: () => void;
}

export function MembersToolbar({
	searchQuery,
	onSearchChange,
	selectedDepartment,
	onDeptChange,
	selectedGrade,
	onClassChange,
	trackOptions,
	levelOptions,
	roleFilter,
	onRolFilterChange,
	roleOptions,
	hasRolelessMember,
	activeFilter,
	onActiveFilterChange,
	totalMembersCount,
	isAuthorizedToAdd,
	isLoading,
	onRefresh,
	onOpenAdd,
}: MembersToolbarProps) {
	const { t, language } = useI18n();

	return (
		<div
			style={{
				position: 'sticky',
				top: 0,
				zIndex: 10,
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
				padding: '12px 18px',
				borderBottom: '1px solid var(--window-border)',
				background: 'var(--window-bg)',
				backdropFilter: 'var(--glass-blur)',
			}}
		>
			{/* Top Bar: Search and Filters */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '10px',
					flexWrap: 'wrap',
				}}
			>
				{/* Search Box */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						background: 'rgba(120, 120, 130, 0.1)',
						padding: '6px 12px',
						borderRadius: '8px',
						border: '1px solid var(--input-border)',
						flex: '1 1 220px',
						minWidth: '180px',
					}}
				>
					<Search size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
					<input
						type="text"
						placeholder={t('membersSearchPlaceholder')}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						style={{
							background: 'transparent',
							border: 'none',
							outline: 'none',
							fontSize: '13px',
							width: '100%',
							color: 'inherit',
						}}
					/>
				</div>

				{/* Filter Dropdowns */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '0 0 auto' }}>
					<select
						className={ui.select}
						value={selectedDepartment}
						onChange={(e) => onDeptChange(e.target.value)}
						style={{ minWidth: 140, maxWidth: 200 }}
						title={t('membersFilterDeptTitle')}
					>
						<option value="">{t('membersFilterAllDepts')}</option>
						{trackOptions.map((option) => (
							<option key={option.value} value={option.value}>{optionLabel(option, language)}</option>
						))}
					</select>

					<select
						className={ui.select}
						value={selectedGrade}
						onChange={(e) => onClassChange(Number(e.target.value))}
						style={{ minWidth: 110, maxWidth: 130 }}
						title={t('membersFilterClassTitle')}
					>
						<option value={0}>{t('membersFilterAllClasses')}</option>
						<option value={-1}>{t('membersFilterPrep')}</option>
						{levelOptions.map((option) => (
							<option key={option.value} value={Number(option.value)}>
								{optionLabel(option, language)}
							</option>
						))}
					</select>

					<select
						className={ui.select}
						value={roleFilter}
						onChange={(e) => onRolFilterChange(e.target.value)}
						data-role-filter
						style={{ minWidth: 120, maxWidth: 150 }}
						title={t('membersFilterRoleTitle')}
					>
						<option value="">{t('membersAllRoles')}</option>
						{roleOptions.map(([id, ad]) => (
							<option key={id} value={id}>{ad}</option>
						))}
						{hasRolelessMember && <option value="-">{t('membersCtxNoRole')}</option>}
					</select>
				</div>
			</div>

			{/* Bottom Bar: Status Tabs & Quick Refresh / Register */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: '12px',
					flexWrap: 'wrap',
				}}
			>
				{/* Segmented Filter Tabs */}
				<div className={ui.segmented}>
					{([
						{ id: 'all', label: `${t('membersFilterAll')} (${totalMembersCount})` },
						{ id: 'aktif', label: t('membersFilterActive') },
						...(isAuthorizedToAdd ? [{ id: 'beklemede', label: t('membersFilterPending') } as const] : []),
						{ id: 'mezun', label: t('membersFilterAlumni') },
					] as const).map((tab) => (
						<button
							key={tab.id}
							type="button"
							className={`${ui.segment} ${activeFilter === tab.id ? ui.segmentActive : ''}`}
							onClick={() => onActiveFilterChange(tab.id)}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Primary Register Action & Refresh */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
					<button
						type="button"
						onClick={onRefresh}
						title={t('membersRefresh')}
						aria-label={t('membersRefresh')}
						className={ui.btn}
						style={{ padding: '6px 10px', display: 'grid', placeItems: 'center' }}
					>
						<RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
					</button>

					{isAuthorizedToAdd && (
						<button
							type="button"
							onClick={onOpenAdd}
							className={ui.primaryBtn}
							title={`${t('membersAddMember')} (⌘N)`}
						>
							<UserPlus size={14} />
							<span>{t('membersAddMember')}</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
