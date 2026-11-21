'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import s from './SocToolbar.module.css';
import { TOOLBAR_I18N } from './i18nToolbar';
import { ToolbarDefconControls } from './ToolbarDefconControls';
import { ToolbarStreamControls } from './ToolbarStreamControls';

export function SocToolbar() {
	const { language } = useI18n();
	const copy = TOOLBAR_I18N[language] ?? TOOLBAR_I18N.en;

	const {
		activeTab,
		globalSearch,
		setGlobalSearch,
		siemSearch,
		setSiemSearch,
		fetchSiemFiltered,
		apiSearch,
		setApiSearch,
		siemTimeRange,
		handleSelectTimeRange,
		liveTail,
		setLiveTail,
		autoRefresh,
		setAutoRefresh,
		isLoading,
		isSubmitting,
		fetchAll,
		fetchInspectionData,
		fimTarget,
		canManage,
		handleExportSiem,
		overview,
		handleResetDefcon,
		isResettingDefcon,
		handleToggleLockdown,
		tb,
		isInspectorOpen,
		toggleInspector,
	} = useSoc();

	const defcon = overview?.defcon ?? 5;
	const isLockdownActive = Boolean(overview?.lockdown.active);

	const handleSearchChange = (value: string) => {
		setGlobalSearch(value);
		if (activeTab === 'siem') {
			setSiemSearch(value);
		} else if (activeTab === 'inspection') {
			setApiSearch(value);
		}
	};

	const currentSearchValue =
		activeTab === 'siem'
			? siemSearch
			: activeTab === 'inspection'
			? apiSearch
			: globalSearch;

	const handleRefresh = () => {
		void fetchAll(false);
		if (activeTab === 'inspection') {
			void fetchInspectionData(fimTarget, true);
		}
		if (activeTab === 'health') {
			void tb.refetchHealth();
		}
	};

	return (
		<div className={s.toolbar}>
			{/* Left: Global Search */}
			<div className={s.leftSection}>
				<div className={s.searchWrap}>
					<Search size={13} className={s.searchIcon} />
					<input
						type="text"
						className={s.searchInput}
						placeholder={copy.searchPlaceholder(activeTab)}
						value={currentSearchValue}
						onChange={(e) => handleSearchChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && activeTab === 'siem') {
								void fetchSiemFiltered();
							}
						}}
					/>
					{currentSearchValue && (
						<button
							type="button"
							className={s.clearSearch}
							onClick={() => handleSearchChange('')}
							title={copy.clearSearch}
						>
							<X size={12} />
						</button>
					)}
				</div>
			</div>

			{/* Right: Controls & Actions */}
			<div className={s.rightSection}>
				<ToolbarDefconControls
					copy={copy}
					defcon={defcon}
					canManage={canManage}
					isResettingDefcon={isResettingDefcon}
					isLockdownActive={isLockdownActive}
					onResetDefcon={handleResetDefcon}
					onToggleLockdown={handleToggleLockdown}
				/>

				<ToolbarStreamControls
					copy={copy}
					activeTab={activeTab}
					canManage={canManage}
					siemTimeRange={siemTimeRange}
					onSelectTimeRange={handleSelectTimeRange}
					liveTail={liveTail}
					onToggleLiveTail={() => setLiveTail((v) => !v)}
					autoRefresh={autoRefresh}
					onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
					onExportCsv={() => handleExportSiem('csv')}
					onRunApiSuite={() => void tb.runApiSuite()}
					isRunningSuite={tb.isRunningSuite}
					onRefresh={handleRefresh}
					isLoading={isLoading}
					isSubmitting={isSubmitting}
					isInspectorOpen={isInspectorOpen}
					onToggleInspector={toggleInspector}
				/>
			</div>
		</div>
	);
}
