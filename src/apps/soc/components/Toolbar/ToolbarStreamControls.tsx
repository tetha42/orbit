'use client';

import React from 'react';
import {
	RefreshCw,
	Activity,
	Radio,
	Download,
	Play,
	PanelRight,
	PanelRightClose,
} from 'lucide-react';
import type { SocTab, TimeRangePreset } from '../../types';
import s from './SocToolbar.module.css';
import type { ToolbarCopy } from './i18nToolbar';

interface ToolbarStreamControlsProps {
	copy: ToolbarCopy;
	activeTab: SocTab;
	canManage: boolean;
	siemTimeRange: TimeRangePreset;
	onSelectTimeRange: (range: TimeRangePreset) => void;
	liveTail: boolean;
	onToggleLiveTail: () => void;
	autoRefresh: boolean;
	onToggleAutoRefresh: () => void;
	onExportCsv: () => void;
	onRunApiSuite: () => void;
	isRunningSuite: boolean;
	onRefresh: () => void;
	isLoading: boolean;
	isSubmitting: boolean;
	isInspectorOpen: boolean;
	onToggleInspector: () => void;
}

export function ToolbarStreamControls({
	copy,
	activeTab,
	canManage,
	siemTimeRange,
	onSelectTimeRange,
	liveTail,
	onToggleLiveTail,
	autoRefresh,
	onToggleAutoRefresh,
	onExportCsv,
	onRunApiSuite,
	isRunningSuite,
	onRefresh,
	isLoading,
	isSubmitting,
	isInspectorOpen,
	onToggleInspector,
}: ToolbarStreamControlsProps) {
	return (
		<>
			{/* Time Range Selector */}
			<select
				className={s.timeSelect}
				value={siemTimeRange}
				onChange={(e) => onSelectTimeRange(e.target.value as TimeRangePreset)}
				title={copy.timeWindowTitle}
			>
				<option value="15m">{copy.timeRangeLabels['15m']}</option>
				<option value="1h">{copy.timeRangeLabels['1h']}</option>
				<option value="6h">{copy.timeRangeLabels['6h']}</option>
				<option value="24h">{copy.timeRangeLabels['24h']}</option>
				<option value="7d">{copy.timeRangeLabels['7d']}</option>
				<option value="all">{copy.timeRangeLabels.all}</option>
				<option value="custom">{copy.timeRangeLabels.custom}</option>
			</select>

			{/* SSE Live Tail Toggle (for SIEM) */}
			<button
				type="button"
				className={`${s.streamBadge} ${liveTail ? s.streamBadgeActive : ''}`}
				onClick={onToggleLiveTail}
				title={copy.liveTailTitle}
			>
				{liveTail ? (
					<>
						<span className={s.pulseDot} />
						<span>Live Tail</span>
					</>
				) : (
					<>
						<Radio size={12} />
						<span>Live Tail</span>
					</>
				)}
			</button>

			{/* 6s Polling Toggle */}
			<button
				type="button"
				className={`${s.streamBadge} ${autoRefresh ? s.streamBadgeActive : ''}`}
				onClick={onToggleAutoRefresh}
				title={copy.pollingTitle}
			>
				<Activity size={12} />
				<span>{autoRefresh ? copy.pollingActiveLabel : copy.pollingPausedLabel}</span>
			</button>

			{/* Quick Context Action: SIEM Export */}
			{activeTab === 'siem' && (
				<button
					type="button"
					className={s.toolbarBtn}
					onClick={onExportCsv}
					title={copy.exportCsvTitle}
				>
					<Download size={12} />
					<span>CSV</span>
				</button>
			)}

			{/* Quick Context Action: API Suite Run */}
			{activeTab === 'api' && canManage && (
				<button
					type="button"
					className={s.toolbarBtn}
					onClick={onRunApiSuite}
					disabled={isRunningSuite}
					title={copy.runAllTitle}
				>
					<Play size={12} />
					<span>{isRunningSuite ? copy.runAllBusyLabel : copy.runAllIdleLabel}</span>
				</button>
			)}

			{/* Refresh Button */}
			<button
				type="button"
				className={s.toolbarBtn}
				onClick={onRefresh}
				disabled={isLoading || isSubmitting}
				title={copy.refreshTitle}
			>
				<RefreshCw size={12} className={isLoading ? s.spin : ''} />
				<span>{copy.refreshLabel}</span>
			</button>

			{/* 3-Pane Inspector Toggle */}
			<button
				type="button"
				className={`${s.toolbarBtn} ${isInspectorOpen ? s.streamBadgeActive : ''}`}
				onClick={onToggleInspector}
				title={copy.inspectorTitle}
			>
				{isInspectorOpen ? <PanelRightClose size={13} /> : <PanelRight size={13} />}
			</button>
		</>
	);
}
