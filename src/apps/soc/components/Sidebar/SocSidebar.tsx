'use client';

import React from 'react';
import {
	Radar,
	Flame,
	Users,
	FileSearch,
	ShieldCheck,
	KeyRound,
	Cpu,
	Activity,
	Eye,
	Bell,
	Lock,
	Unlock,
	ShieldAlert,
	RotateCcw,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { LAB_KULLAN_TABS } from '../../types';
import s from './SocSidebar.module.css';

export function SocSidebar() {
	const {
		activeTab,
		setActiveTab,
		openLabTab,
		overview,
		bans,
		sessions,
		siemLogs,
		canManage,
		isEn,
		isResettingDefcon,
		handleResetDefcon,
		handleToggleLockdown,
		setShowWebhookModal,
	} = useSoc();

	const defcon = overview?.defcon ?? 5;
	const isLockdownActive = Boolean(overview?.lockdown.active);
	const activeBansCount = bans.filter((b) => b.status === 'ban').length;

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

	return (
		<aside className={s.sidebar} aria-label={isEn ? 'SoC Studio Navigation' : 'SoC Studio Gezinme'}>
			{/* Brand Header */}
			<div className={s.header}>
				<div className={s.brandIcon}>
					<ShieldAlert size={16} />
				</div>
				<div className={s.brandInfo}>
					<span className={s.brandTitle}>SoC Studio</span>
					<span className={s.brandSubtitle}>
						{isEn ? 'Cyber Defense & Lab' : 'Siber Savunma & Test'}
					</span>
				</div>
			</div>

			{/* Source List Groups */}
			<div className={s.scrollArea}>
				{/* Group 1: Operations & Defense */}
				<div className={s.group}>
					<div className={s.groupTitle}>
						{isEn ? 'Operations & Defense' : 'Operasyon & Savunma'}
					</div>

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'radar' ? s.navItemActive : ''}`}
						onClick={() => setActiveTab('radar')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><Radar size={14} /></span>
							<span className={s.navLabel}>{isEn ? 'Live Threat Radar' : 'Canlı Tehdit Radarı'}</span>
						</div>
						<div className={s.navItemRight}>
							<span className={s.shortcut}>⌥1</span>
						</div>
					</button>

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'firewall' ? s.navItemActive : ''}`}
						onClick={() => setActiveTab('firewall')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><Flame size={14} /></span>
							<span className={s.navLabel}>{isEn ? 'Firewall & Rules' : 'Güvenlik Duvarı'}</span>
						</div>
						<div className={s.navItemRight}>
							{activeBansCount > 0 && (
								<span className={s.countBadge}>{activeBansCount}</span>
							)}
							<span className={s.shortcut}>⌥2</span>
						</div>
					</button>

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'sessions' ? s.navItemActive : ''}`}
						onClick={() => setActiveTab('sessions')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><Users size={14} /></span>
							<span className={s.navLabel}>{isEn ? 'Active Sessions' : 'Aktif Oturumlar'}</span>
						</div>
						<div className={s.navItemRight}>
							{sessions.length > 0 && (
								<span className={s.countBadge}>{sessions.length}</span>
							)}
							<span className={s.shortcut}>⌥3</span>
						</div>
					</button>
				</div>

				{/* Group 2: Forensics & Audit */}
				<div className={s.group}>
					<div className={s.groupTitle}>
						{isEn ? 'Forensics & Audit' : 'Adli Analiz & Denetim'}
					</div>

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'siem' ? s.navItemActive : ''}`}
						onClick={() => setActiveTab('siem')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><FileSearch size={14} /></span>
							<span className={s.navLabel}>SIEM Forensics</span>
						</div>
						<div className={s.navItemRight}>
							{siemLogs.length > 0 && (
								<span className={s.countBadge}>{siemLogs.length}</span>
							)}
							<span className={s.shortcut}>⌥4</span>
						</div>
					</button>

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'inspection' ? s.navItemActive : ''}`}
						onClick={() => setActiveTab('inspection')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><ShieldCheck size={14} /></span>
							<span className={s.navLabel}>{isEn ? 'Blue Team Inspection' : 'Mavi Takım Teftiş'}</span>
						</div>
						<div className={s.navItemRight}>
							<span className={s.shortcut}>⌥5</span>
						</div>
					</button>
				</div>

				{/* Group 3: Test Lab & Diagnostics */}
				<div className={s.group}>
					<div className={s.groupTitle}>
						{isEn ? 'Test Lab & Diagnostics' : 'Test Laboratuvarı'}
					</div>

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'fuzzer' ? s.navItemActive : ''}`}
						onClick={() => openLabTab('fuzzer')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><Flame size={14} style={{ color: '#ff9500' }} /></span>
							<span className={s.navLabel}>{isEn ? 'WAF & Red Team Fuzzer' : 'WAF & Red Team Testi'}</span>
						</div>
						<div className={s.navItemRight}>
							<span className={s.shortcut}>⌥6</span>
						</div>
					</button>

					{(canManage || LAB_KULLAN_TABS.includes('oauth')) && (
						<button
							type="button"
							className={`${s.navItem} ${activeTab === 'oauth' ? s.navItemActive : ''}`}
							onClick={() => openLabTab('oauth')}
						>
							<div className={s.navItemLeft}>
								<span className={s.navIcon}><KeyRound size={14} /></span>
								<span className={s.navLabel}>{isEn ? 'OAuth 2.0 Simulator' : 'OAuth 2.0 Simülatörü'}</span>
							</div>
							<div className={s.navItemRight}>
								<span className={s.shortcut}>⌥7</span>
							</div>
						</button>
					)}

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'api' ? s.navItemActive : ''}`}
						onClick={() => openLabTab('api')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><Cpu size={14} /></span>
							<span className={s.navLabel}>{isEn ? 'API Security Suite' : 'API Test Paketi'}</span>
						</div>
						<div className={s.navItemRight}>
							<span className={s.shortcut}>⌥8</span>
						</div>
					</button>

					{(canManage || LAB_KULLAN_TABS.includes('health')) && (
						<button
							type="button"
							className={`${s.navItem} ${activeTab === 'health' ? s.navItemActive : ''}`}
							onClick={() => openLabTab('health')}
						>
							<div className={s.navItemLeft}>
								<span className={s.navIcon}><Activity size={14} /></span>
								<span className={s.navLabel}>{isEn ? 'System Diagnostics' : 'Sistem Teşhisleri'}</span>
							</div>
							<div className={s.navItemRight}>
								<span className={s.shortcut}>⌥9</span>
							</div>
						</button>
					)}

					<button
						type="button"
						className={`${s.navItem} ${activeTab === 'session' ? s.navItemActive : ''}`}
						onClick={() => openLabTab('session')}
					>
						<div className={s.navItemLeft}>
							<span className={s.navIcon}><Eye size={14} /></span>
							<span className={s.navLabel}>{isEn ? 'Session Inspector' : 'Oturum Röntgeni'}</span>
						</div>
						<div className={s.navItemRight}>
							<span className={s.shortcut}>⌥9</span>
						</div>
					</button>
				</div>
			</div>

			{/* Sidebar Footer: DEFCON + Lockdown */}
			<div className={s.footer}>
				<div className={s.defconRow}>
					<div className={s.defconPill}>
						<span className={`${s.defconDot} ${dotClass}`} />
						<span>DEFCON {defcon}</span>
					</div>
					{canManage && defcon < 5 && (
						<button
							type="button"
							className={s.resetDefconBtn}
							onClick={handleResetDefcon}
							disabled={isResettingDefcon}
							title={isEn ? 'Acknowledge alerts and restore DEFCON 5' : 'Alarmları onayla ve DEFCON 5 yap'}
						>
							<RotateCcw size={11} />
							<span>{isEn ? 'Reset' : 'Sıfırla'}</span>
						</button>
					)}
				</div>

				<div className={s.footerActions}>
					{canManage && (
						<button
							type="button"
							className={`${s.lockdownBtn} ${isLockdownActive ? s.lockdownBtnActive : ''}`}
							onClick={() => void handleToggleLockdown()}
							title={
								isLockdownActive
									? isEn
										? 'Lockdown Active: Click to Lift'
										: 'Kalkan Aktif: Kaldırmak için tıklayın'
									: isEn
									? 'Emergency Lockdown: Suspend signups & double IPS strike rate'
									: 'Acil Durum Kalkanı: Kayıtları durdur ve IPS puanını 2x yap'
							}
						>
							{isLockdownActive ? <Lock size={12} /> : <Unlock size={12} />}
							<span>{isLockdownActive ? (isEn ? 'Lockdown ON' : 'Kalkan Aktif') : (isEn ? 'Lockdown' : 'Kalkan')}</span>
						</button>
					)}

					{canManage && (
						<button
							type="button"
							className={s.iconBtn}
							onClick={() => setShowWebhookModal(true)}
							title={isEn ? 'Configure External Webhooks (Discord / Telegram)' : 'Dış Güvenlik Webhook Bildirimleri'}
						>
							<Bell size={13} />
						</button>
					)}
				</div>
			</div>
		</aside>
	);
}
