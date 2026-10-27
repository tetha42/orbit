'use client';

import React from 'react';
import {
	Search,
	X,
	RefreshCw,
	Activity,
	Radio,
	Download,
	Play,
	Lock,
	Unlock,
	ShieldCheck,
	PanelRight,
	PanelRightClose,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import type { TimeRangePreset } from '../../types';
import s from './SocToolbar.module.css';

export function SocToolbar() {
	const {
		activeTab,
		globalSearch,
		setGlobalSearch,
		siemArama,
		setSiemArama,
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
		isEn,
		canManage,
		handleExportSiem,
		overview,
		handleResetDefcon,
		isResettingDefcon,
		handleToggleLockdown,
		tb,
		isInspectorOpen,
		toggleInspector,
		selectedHourFilter,
		setSelectedHourFilter,
	} = useSoc();

	const defcon = overview?.defcon ?? 5;
	const isLockdownActive = Boolean(overview?.lockdown.active);

	const dotClass =
		defcon === 1
			? s.defconDot1
			: defcon === 2
			? s.defconDot2
			: defcon === 3
			? s.defconDot3
			: defcon === 4
			? s.defconDot4
			: s.defconDot5;

	const handleSearchChange = (value: string) => {
		setGlobalSearch(value);
		if (activeTab === 'siem') {
			setSiemArama(value);
		} else if (activeTab === 'inspection') {
			setApiSearch(value);
		}
	};

	const currentSearchValue =
		activeTab === 'siem'
			? siemArama
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
						placeholder={
							activeTab === 'siem'
								? isEn
									? 'Search forensic logs, query terms, IP...'
									: 'Adli kayıtlar, sorgular, IP ara...'
								: activeTab === 'inspection'
								? isEn
									? 'Filter API endpoints (/api/...)'
									: 'Uç nokta ara (/api/...)'
								: isEn
								? 'Quick search in studio...'
								: 'Studio içinde hızlı ara...'
						}
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
							title={isEn ? 'Clear search' : 'Aramayı temizle'}
						>
							<X size={12} />
						</button>
					)}
				</div>
			</div>

			{/* Right: Controls & Actions */}
			<div className={s.rightSection}>
				{/* DEFCON Posture Pill */}
				<div
					className={s.defconPill}
					title={
						isEn
							? `DEFCON ${defcon} Posture: ${
									defcon === 1
										? 'Lockdown / Under Attack'
										: defcon === 2
										? 'High Threat Level'
										: defcon === 3
										? 'Elevated Vigilance'
										: defcon === 4
										? 'Guarded'
										: 'Peace Mode (Normal)'
							  }`
							: `DEFCON ${defcon} Kalkanı: ${
									defcon === 1
										? 'Saldırı Altındayız'
										: defcon === 2
										? 'Yüksek Tehdit'
										: defcon === 3
										? 'Artırılmış Dikkat'
										: defcon === 4
										? 'Tetik'
										: 'Barış Hali (Standart)'
							  }`
					}
				>
					<span className={`${s.defconDot} ${dotClass}`} />
					<span>DEFCON {defcon}</span>
					{canManage && defcon < 5 && (
						<button
							type="button"
							className={s.toolbarResetDefcon}
							onClick={handleResetDefcon}
							disabled={isResettingDefcon}
							title={isEn ? 'Acknowledge alerts and restore DEFCON 5' : 'Alarmları onayla ve DEFCON 5 yap'}
						>
							<ShieldCheck size={11} />
						</button>
					)}
				</div>

				{/* Emergency Lockdown Action */}
				{canManage && (
					<button
						type="button"
						className={`${s.toolbarLockdownBtn} ${isLockdownActive ? s.toolbarLockdownBtnActive : ''}`}
						onClick={() => void handleToggleLockdown()}
						title={
							isLockdownActive
								? isEn
									? 'DEFCON 1 Lockdown Active: Click to Lift'
									: 'DEFCON 1 Kalkan Aktif: Kaldırmak için tıklayın'
								: isEn
								? 'Emergency Lockdown: Suspend signups & double IPS strike rate'
								: 'Acil Durum Kalkanı: Kayıtları durdur ve IPS puanını 2x yap'
						}
					>
						{isLockdownActive ? <Lock size={12} /> : <Unlock size={12} />}
						<span>{isLockdownActive ? (isEn ? 'Lockdown ON' : 'Kalkan Aktif') : isEn ? 'Lockdown' : 'Kalkan'}</span>
					</button>
				)}

				{/* Time Range Selector */}
				<select
					className={s.timeSelect}
					value={siemTimeRange}
					onChange={(e) => handleSelectTimeRange(e.target.value as TimeRangePreset)}
					title={isEn ? 'Filter telemetry time window' : 'Telemetri zaman aralığı'}
				>
					<option value="15m">{isEn ? 'Last 15m' : 'Son 15 Dk'}</option>
					<option value="1h">{isEn ? 'Last 1h' : 'Son 1 Saat'}</option>
					<option value="6h">{isEn ? 'Last 6h' : 'Son 6 Saat'}</option>
					<option value="24h">{isEn ? 'Last 24h' : 'Son 24 Saat'}</option>
					<option value="7d">{isEn ? 'Last 7d' : 'Son 7 Gün'}</option>
					<option value="all">{isEn ? 'All Time' : 'Tüm Zamanlar'}</option>
					<option value="custom">{isEn ? 'Custom...' : 'Özel...'}</option>
				</select>

				{/* SSE Live Tail Toggle (for SIEM) */}
				<button
					type="button"
					className={`${s.streamBadge} ${liveTail ? s.streamBadgeActive : ''}`}
					onClick={() => setLiveTail((v) => !v)}
					title={isEn ? 'Toggle real-time SSE live tail log stream' : 'Canlı SSE log akışını aç/kapat'}
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
					onClick={() => setAutoRefresh((v) => !v)}
					title={isEn ? 'Toggle background telemetry polling (6s)' : '6 saniyelik arka plan telemetri akışını aç/kapat'}
				>
					<Activity size={12} />
					<span>{autoRefresh ? (isEn ? '6s' : '6sn') : isEn ? 'Paused' : 'Duraklatıldı'}</span>
				</button>

				{/* Quick Context Action: SIEM Export */}
				{activeTab === 'siem' && (
					<button
						type="button"
						className={s.toolbarBtn}
						onClick={() => handleExportSiem('csv')}
						title={isEn ? 'Export SIEM logs as CSV' : 'SIEM kayıtlarını CSV indir'}
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
						onClick={() => void tb.runApiSuite()}
						disabled={tb.isRunningSuite}
						title={isEn ? 'Run complete API Security Suite (⌥⌘R)' : 'Tüm API Güvenlik Testlerini Çalıştır (⌥⌘R)'}
					>
						<Play size={12} />
						<span>{tb.isRunningSuite ? (isEn ? 'Testing...' : 'Test Ediliyor...') : (isEn ? 'Run All' : 'Tümünü Çalıştır')}</span>
					</button>
				)}

				{/* Active 24h Timeline Hour Filter Indicator */}
				{selectedHourFilter && (
					<div
						className={s.streamBadge}
						style={{
							background: 'color-mix(in srgb, var(--accent, #0071e3) 12%, transparent)',
							borderColor: 'color-mix(in srgb, var(--accent, #0071e3) 30%, transparent)',
							color: 'var(--accent, #0071e3)',
						}}
					>
						<span>{selectedHourFilter.hourLabel}</span>
						<button
							type="button"
							onClick={() => setSelectedHourFilter(null)}
							title={isEn ? 'Clear hour filter' : 'Saat filtresini temizle'}
							style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
						>
							<X size={11} />
						</button>
					</div>
				)}

				{/* Refresh Button */}
				<button
					type="button"
					className={s.toolbarBtn}
					onClick={handleRefresh}
					disabled={isLoading || isSubmitting}
					title={isEn ? 'Refresh Telemetry (⌘R)' : 'Telemetriyi Yenile (⌘R)'}
				>
					<RefreshCw size={12} className={isLoading ? s.spin : ''} />
					<span>{isEn ? 'Refresh' : 'Yenile'}</span>
				</button>

				{/* 3-Pane Inspector Toggle */}
				<button
					type="button"
					className={`${s.toolbarBtn} ${isInspectorOpen ? s.streamBadgeActive : ''}`}
					onClick={toggleInspector}
					title={isEn ? 'Toggle Forensic Inspector Drawer (⌥I)' : 'Adli İnceleme Çekmecesini Aç/Kapat (⌥I)'}
				>
					{isInspectorOpen ? <PanelRightClose size={13} /> : <PanelRight size={13} />}
				</button>
			</div>
		</div>
	);
}
