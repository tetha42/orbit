'use client';

import React, { useEffect, useCallback } from 'react';
import { useAppCommand, REFRESH_EVENT } from '@/core/commands';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useIsActive } from '@/core/windows/hooks';
import { isEditableElement } from '@/lib/client/dom';
import { SocProvider, useSoc } from './context/SocContext';
import { SocSidebar } from './components/Sidebar/SocSidebar';
import { SocToolbar } from './components/Toolbar/SocToolbar';
import { SocInspector } from './components/Inspector/SocInspector';
import { SocTabViews, SocStudioOverlays } from './SocTabViews';
import { SocMobileNav, SocRestrictedView, SocStatusBanners } from './SocShellBanners';
import { isLabTab } from './types';
import type { SocTab } from './types';
import s from './Soc.module.css';

function SocStudioShell() {
	const {
		canView,
		canManage,
		activeTab,
		setActiveTab,
		openLabTab,
		overview,
		banner,
		setBanner,
		handleResetDefcon,
		handleToggleLockdown,
		fetchAll,
		fetchInspectionData,
		fimTarget,
		isResettingDefcon,
		isSubmitting,
		tb,
		language,
		toggleInspector,
		openContextMenu,
	} = useSoc();

	const isMobile = useIsMobile();
	const isSocActive = useIsActive('soc');
	const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			const target = (e.target as HTMLElement).closest('[data-type]');
			if (target) {
				const type = target.getAttribute('data-type') as 'ip' | 'user' | 'service' | 'hash';
				const value = target.getAttribute('data-value') || target.textContent?.trim() || '';
				if (type && value) {
					openContextMenu(e, type, value);
				}
			}
		},
		[openContextMenu]
	);

	// Topbar Command Integration
	useAppCommand(
		'soc',
		(cmd) => {
			if (cmd === 'tab-radar') setActiveTab('radar');
			else if (cmd === 'tab-firewall') setActiveTab('firewall');
			else if (cmd === 'tab-sessions') setActiveTab('sessions');
			else if (cmd === 'tab-siem') setActiveTab('siem');
			else if (cmd === 'tab-inspection') setActiveTab('inspection');
			else if (cmd === 'tab-audit') setActiveTab('audit');
			else if (cmd === 'tab-fuzzer') openLabTab('fuzzer');
			else if (cmd === 'tab-oauth') openLabTab('oauth');
			else if (cmd === 'tab-api') openLabTab('api');
			else if (cmd === 'tab-health') openLabTab('health');
			else if (cmd === 'tab-session') openLabTab('session');
			else if (cmd === 'run-api-suite') {
				setActiveTab('api');
				void tb.runApiSuite();
			} else if (cmd === 'refresh-health') {
				setActiveTab('health');
				void tb.refetchHealth();
			} else if (cmd === 'soc-refresh') {
				void fetchAll(false);
				if (activeTab === 'inspection') {
					void fetchInspectionData(fimTarget, true);
				}
				if (activeTab === 'health') {
					void tb.refetchHealth();
				}
			}
		},
		canView
	);

	// Keyboard Shortcuts (Cmd+K / Ctrl+K and Option 1 - 9)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only handle shortcuts when SoC window is active
			if (!isSocActive) return;

			// Command Palette (Cmd+K / Ctrl+K)
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				setCommandPaletteOpen((prev) => !prev);
				return;
			}

			// Require Alt/Option key (or Alt on Windows/Linux)
			if (e.altKey && !e.ctrlKey && !e.metaKey) {
				// Stand down when user is typing in an input, textarea or contenteditable
				if (isEditableElement(document.activeElement)) return;

				// On macOS Option+number emits composed characters in e.key (e.g. ¡, ™, £).
				// Match e.code (Digit1-Digit9) with e.key fallback for universal support.
				const digitMatch = e.code.match(/^(?:Digit|Numpad)([1-9])$/);
				const key = digitMatch ? digitMatch[1] : e.key;

				if (e.code === 'KeyI' || e.key.toLowerCase() === 'i') {
					e.preventDefault();
					toggleInspector();
					return;
				}
				if (e.code === 'KeyA' || e.key.toLowerCase() === 'a') {
					e.preventDefault();
					if (canManage) setActiveTab('audit');
					return;
				}

				const shortcutMap: Record<string, SocTab> = {
					'1': 'radar',
					'2': 'firewall',
					'3': 'sessions',
					'4': 'siem',
					'5': 'inspection',
					'6': 'fuzzer',
					'7': 'oauth',
					'8': 'api',
					'9': 'health',
				};
				if (shortcutMap[key]) {
					e.preventDefault();
					const target = shortcutMap[key];
					if (isLabTab(target)) {
						openLabTab(target);
					} else {
						setActiveTab(target);
					}
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isSocActive, setActiveTab, openLabTab, toggleInspector, canManage]);

	// Global Refresh Event
	useEffect(() => {
		const onGlobalRefresh = () => {
			void fetchAll(false);
			if (activeTab === 'inspection') {
				void fetchInspectionData(fimTarget, true);
			}
			if (activeTab === 'health') {
				void tb.refetchHealth();
			}
		};
		window.addEventListener(REFRESH_EVENT, onGlobalRefresh);
		return () => window.removeEventListener(REFRESH_EVENT, onGlobalRefresh);
	}, [fetchAll, activeTab, fetchInspectionData, fimTarget, tb]);

	if (!canView) {
		return <SocRestrictedView language={language} />;
	}

	const defcon = overview?.defcon ?? 5;
	const isLockdownActive = Boolean(overview?.lockdown.active);

	return (
		<div className={s.studioLayout} onContextMenu={handleContextMenu}>
			{/* 1. Left macOS Source List Sidebar */}
			{!isMobile && <SocSidebar />}

			{/* 2. Main Studio Canvas */}
			<div className={s.mainCanvas}>
				{/* Top Unified Toolbar */}
				<SocToolbar />

				<SocStatusBanners
					language={language}
					defcon={defcon}
					isLockdownActive={isLockdownActive}
					canManage={canManage}
					isSubmitting={isSubmitting}
					isResettingDefcon={isResettingDefcon}
					banner={banner}
					onDismissBanner={() => setBanner(null)}
					onToggleLockdown={handleToggleLockdown}
					onResetDefcon={handleResetDefcon}
				/>

				{/* Canvas Content Views */}
				<SocTabViews activeTab={activeTab} />
			</div>

			{/* 3. Collapsible 3-Pane Inspector Drawer */}
			<SocInspector />

			{/* Mobile Bottom Navigation */}
			{isMobile && (
				<SocMobileNav
					language={language}
					activeTab={activeTab}
					canManage={canManage}
					onSelectTab={setActiveTab}
					onOpenLabTab={openLabTab}
				/>
			)}

			<SocStudioOverlays
				commandPaletteOpen={commandPaletteOpen}
				onCloseCommandPalette={() => setCommandPaletteOpen(false)}
			/>
		</div>
	);
}

export function SocApp() {
	return (
		<SocProvider>
			<SocStudioShell />
		</SocProvider>
	);
}

export default SocApp;
