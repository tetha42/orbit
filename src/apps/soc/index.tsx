'use client';

import React, { useEffect, useCallback } from 'react';
import {
	ShieldAlert,
	AlertTriangle,
	ShieldCheck,
	Radar,
	Flame,
	Users,
	FileSearch,
	FlaskConical,
	X,
} from 'lucide-react';
import { useAppCommand, REFRESH_EVENT } from '@/core/commands';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useIsActive } from '@/core/windows/hooks';
import { isEditableElement } from '@/lib/client/dom';
import { SocProvider, useSoc } from './context/SocContext';
import { SocSidebar } from './components/Sidebar/SocSidebar';
import { SocToolbar } from './components/Toolbar/SocToolbar';
import { RadarView } from './components/views/RadarView';
import { FirewallView } from './components/views/FirewallView';
import { SessionsView } from './components/views/SessionsView';
import { SiemView } from './components/views/SiemView';
import { InspectionView } from './components/views/InspectionView';
import { TestbenchView } from './components/views/TestbenchView';
import { SocInspector } from './components/Inspector/SocInspector';
import { SocContextMenu } from './components/ContextMenu/SocContextMenu';
import { LockdownModal } from './components/modals/LockdownModal';
import { ForensicPayloadModal } from './components/modals/ForensicPayloadModal';
import { WebhookModal } from './components/modals/WebhookModal';
import { CustomDateModal } from './components/modals/CustomDateModal';
import { SocCommandPalette } from './components/modals/SocCommandPalette';
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
		isEn,
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
	}, [isSocActive, setActiveTab, openLabTab, toggleInspector]);

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
		return (
			<div className={s.root} style={{ display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>
				<div
					style={{
						maxWidth: 440,
						background: 'color-mix(in srgb, var(--danger, #d70015) 8%, transparent)',
						border: '1px solid color-mix(in srgb, var(--danger, #d70015) 25%, transparent)',
						borderRadius: 12,
						padding: '28px 24px',
					}}
				>
					<ShieldAlert size={40} color="var(--danger, #d70015)" style={{ marginBottom: 12 }} />
					<h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
						{isEn ? 'SoC Studio Restricted' : 'SoC Komuta Merkezi Permission Korumalı'}
					</h2>
					<p style={{ fontSize: 13, opacity: 0.8, margin: 0, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
						{isEn
							? 'You need SoC Security Center permission to view live threat telemetry, firewall rules, and SIEM forensics.'
							: 'Canlı tehdit telemetrisini, IP karantina duvarını ve SIEM adli kayıtlarını görüntülemek için SoC Güvenlik Merkezi yetkisine sahip olmalısınız.'}
					</p>
				</div>
			</div>
		);
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

				{/* Active Lockdown Banner */}
				{isLockdownActive && (
					<div className={s.lockdownBanner}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<AlertTriangle size={15} />
							<span>
								<strong>{isEn ? 'DEFCON 1 LOCKDOWN ACTIVE:' : 'DEFCON 1 KALKAN MODU AKTİF:'}</strong>{' '}
								{isEn
									? 'Public registration & password resets are suspended; IPS threat scoring multiplier is 2x.'
									: 'Yeni üye alımı ve şifre sıfırlama durduruldu; IPS tehdit puanı çarpanı 2x olarak uygulanıyor.'}
							</span>
						</div>
						{canManage && (
							<button
								type="button"
								className={s.actionBtn}
								onClick={() => void handleToggleLockdown()}
								disabled={isSubmitting}
								style={{ padding: '3px 9px', fontSize: 11 }}
							>
								{isEn ? 'Lift Lockdown' : 'Kalkanı Kaldır'}
							</button>
						)}
					</div>
				)}

				{/* Elevated Threat Alert Banner (DEFCON 2 & 3) */}
				{!isLockdownActive && defcon <= 3 && (
					<div
						className={s.lockdownBanner}
						style={{
							background:
								defcon === 2
									? 'color-mix(in srgb, #f97316 12%, transparent)'
									: 'color-mix(in srgb, var(--warning, #c45500) 12%, transparent)',
							borderColor:
								defcon === 2
									? 'color-mix(in srgb, #f97316 30%, transparent)'
									: 'color-mix(in srgb, var(--warning, #c45500) 30%, transparent)',
							color: defcon === 2 ? '#f97316' : 'var(--warning, #c45500)',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<AlertTriangle size={15} />
							<span>
								<strong>
									DEFCON {defcon}{' '}
									{defcon === 2
										? isEn
											? 'HIGH THREAT LEVEL (Alerts Present):'
											: 'YÜKSEK TEHDİT SEVİYESİ (Alarmlar Mevcut):'
										: isEn
										? 'ELEVATED VIGILANCE:'
										: 'ARTIRILMIŞ GÜVENLİK DİKKATİ:'}
								</strong>{' '}
								{isEn
									? 'Threat baseline counters indicate active security strikes or bans. Acknowledge alerts to restore DEFCON 5 peace mode.'
									: 'Tehdit alarmları ve karantina sayaçları aktif güvenlik olaylarına işaret ediyor. Alarmları onaylayarak barış moduna (DEFCON 5) dönebilirsiniz.'}
							</span>
						</div>
						{canManage && (
							<button
								type="button"
								className={`${s.actionBtn} ${s.actionBtnSuccess}`}
								onClick={handleResetDefcon}
								disabled={isResettingDefcon}
								style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', fontSize: 11 }}
							>
								<ShieldCheck size={12} />
								<span>{isEn ? 'Acknowledge & Reset DEFCON 5' : 'Alarmları Onayla & DEFCON 5 Yap'}</span>
							</button>
						)}
					</div>
				)}

				{/* Notice Banner */}
				{banner && (
					<div className={`${s.bannerNotice} ${banner.type === 'err' ? s.bannerError : ''}`}>
						<span>{banner.text}</span>
						<button
							type="button"
							className={s.actionBtn}
							onClick={() => setBanner(null)}
							style={{ padding: '2px 7px' }}
						>
							<X size={12} />
						</button>
					</div>
				)}

				{/* Canvas Content Views */}
				{activeTab === 'radar' && <RadarView />}
				{activeTab === 'firewall' && <FirewallView />}
				{activeTab === 'sessions' && <SessionsView />}
				{activeTab === 'siem' && <SiemView />}
				{activeTab === 'inspection' && <InspectionView />}
				{isLabTab(activeTab) && <TestbenchView />}
			</div>

			{/* 3. Collapsible 3-Pane Inspector Drawer */}
			<SocInspector />

			{/* Mobile Bottom Navigation */}
			{isMobile && (
				<nav className={s.mobileBottomNav} aria-label="SoC Mobile Navigation">
					<button
						type="button"
						className={`${s.mobileNavBtn} ${activeTab === 'radar' ? s.mobileNavBtnActive : ''}`}
						onClick={() => setActiveTab('radar')}
					>
						<Radar size={16} />
						<span>{isEn ? 'Radar' : 'Radar'}</span>
					</button>
					<button
						type="button"
						className={`${s.mobileNavBtn} ${activeTab === 'firewall' ? s.mobileNavBtnActive : ''}`}
						onClick={() => setActiveTab('firewall')}
					>
						<Flame size={16} />
						<span>{isEn ? 'Firewall' : 'Karantina'}</span>
					</button>
					<button
						type="button"
						className={`${s.mobileNavBtn} ${activeTab === 'sessions' ? s.mobileNavBtnActive : ''}`}
						onClick={() => setActiveTab('sessions')}
					>
						<Users size={16} />
						<span>{isEn ? 'Sessions' : 'Oturumlar'}</span>
					</button>
					<button
						type="button"
						className={`${s.mobileNavBtn} ${activeTab === 'siem' ? s.mobileNavBtnActive : ''}`}
						onClick={() => setActiveTab('siem')}
					>
						<FileSearch size={16} />
						<span>SIEM</span>
					</button>
					<button
						type="button"
						className={`${s.mobileNavBtn} ${activeTab === 'inspection' ? s.mobileNavBtnActive : ''}`}
						onClick={() => setActiveTab('inspection')}
					>
						<ShieldCheck size={16} />
						<span>{isEn ? 'Inspection' : 'Teftiş'}</span>
					</button>
					<button
						type="button"
						className={`${s.mobileNavBtn} ${isLabTab(activeTab) ? s.mobileNavBtnActive : ''}`}
						onClick={() => openLabTab(isLabTab(activeTab) ? activeTab : 'oauth')}
					>
						<FlaskConical size={16} />
						<span>Lab</span>
					</button>
				</nav>
			)}

			{/* Universal Right-Click Context Menu */}
			<SocContextMenu />

			{/* Studio Modals */}
			<LockdownModal />
			<ForensicPayloadModal />
			<WebhookModal />
			<CustomDateModal />
			<SocCommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
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
