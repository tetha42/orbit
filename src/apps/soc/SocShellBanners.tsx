'use client';

import React from 'react';
import {
	ShieldAlert,
	AlertTriangle,
	ShieldCheck,
	Radar,
	Flame,
	Users,
	FileSearch,
	History,
	FlaskConical,
	X,
} from 'lucide-react';
import { isLabTab } from './types';
import type { SocTab } from './types';
import { SOC_SHELL_COPY } from './i18nSocShellCopy';
import s from './Soc.module.css';

export function SocRestrictedView({ language }: { language: 'tr' | 'en' }) {
	const copy = SOC_SHELL_COPY[language];
	return (
		<div className={s.root} style={{ display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>
			<div
				style={{
					maxWidth: 440,
					background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
					border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
					borderRadius: 12,
					padding: '28px 24px',
				}}
			>
				<ShieldAlert size={40} color="var(--danger)" style={{ marginBottom: 12 }} />
				<h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
					{copy.restrictedTitle}
				</h2>
				<p style={{ fontSize: 13, opacity: 0.8, margin: 0, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
					{copy.restrictedBody}
				</p>
			</div>
		</div>
	);
}

interface SocStatusBannersProps {
	language: 'tr' | 'en';
	defcon: number;
	isLockdownActive: boolean;
	canManage: boolean;
	isSubmitting: boolean;
	isResettingDefcon: boolean;
	banner: { type: 'ok' | 'err'; text: string } | null;
	onDismissBanner: () => void;
	onToggleLockdown: () => void | Promise<void>;
	onResetDefcon: () => void;
}

export function SocStatusBanners({
	language,
	defcon,
	isLockdownActive,
	canManage,
	isSubmitting,
	isResettingDefcon,
	banner,
	onDismissBanner,
	onToggleLockdown,
	onResetDefcon,
}: SocStatusBannersProps) {
	const copy = SOC_SHELL_COPY[language];
	const defconHeading = defcon === 2 ? copy.defconHigh : copy.defconElevated;

	return (
		<>
			{isLockdownActive && (
				<div className={s.lockdownBanner}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
						<AlertTriangle size={15} />
						<span>
							<strong>{copy.lockdownTitle}</strong> {copy.lockdownBody}
						</span>
					</div>
					{canManage && (
						<button
							type="button"
							className={s.actionBtn}
							onClick={() => void onToggleLockdown()}
							disabled={isSubmitting}
							style={{ padding: '3px 9px', fontSize: 11 }}
						>
							{copy.liftLockdown}
						</button>
					)}
				</div>
			)}

			{!isLockdownActive && defcon <= 3 && (
				<div
					className={s.lockdownBanner}
					style={{
						background:
							defcon === 2
								? 'color-mix(in srgb, var(--warning) 12%, transparent)'
								: 'color-mix(in srgb, var(--warning) 12%, transparent)',
						borderColor:
							defcon === 2
								? 'color-mix(in srgb, var(--warning) 30%, transparent)'
								: 'color-mix(in srgb, var(--warning) 30%, transparent)',
						color: defcon === 2 ? 'var(--warning)' : 'var(--warning)',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
						<AlertTriangle size={15} />
						<span>
							<strong>
								DEFCON {defcon} {defconHeading}
							</strong>{' '}
							{copy.defconBody}
						</span>
					</div>
					{canManage && (
						<button
							type="button"
							className={`${s.actionBtn} ${s.actionBtnSuccess}`}
							onClick={onResetDefcon}
							disabled={isResettingDefcon}
							style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', fontSize: 11 }}
						>
							<ShieldCheck size={12} />
							<span>{copy.ackDefcon}</span>
						</button>
					)}
				</div>
			)}

			{banner && (
				<div className={`${s.bannerNotice} ${banner.type === 'err' ? s.bannerError : ''}`}>
					<span>{banner.text}</span>
					<button
						type="button"
						className={s.actionBtn}
						onClick={onDismissBanner}
						style={{ padding: '2px 7px' }}
					>
						<X size={12} />
					</button>
				</div>
			)}
		</>
	);
}

interface SocMobileNavProps {
	language: 'tr' | 'en';
	activeTab: SocTab;
	canManage: boolean;
	onSelectTab: (tab: SocTab) => void;
	onOpenLabTab: (tab: 'fuzzer' | 'oauth' | 'api' | 'health' | 'session') => void;
}

export function SocMobileNav({
	language,
	activeTab,
	canManage,
	onSelectTab,
	onOpenLabTab,
}: SocMobileNavProps) {
	const copy = SOC_SHELL_COPY[language];
	return (
		<nav className={s.mobileBottomNav} aria-label="SoC Mobile Navigation">
			<button
				type="button"
				className={`${s.mobileNavBtn} ${activeTab === 'radar' ? s.mobileNavBtnActive : ''}`}
				onClick={() => onSelectTab('radar')}
			>
				<Radar size={16} />
				<span>{copy.navRadar}</span>
			</button>
			<button
				type="button"
				className={`${s.mobileNavBtn} ${activeTab === 'firewall' ? s.mobileNavBtnActive : ''}`}
				onClick={() => onSelectTab('firewall')}
			>
				<Flame size={16} />
				<span>{copy.navFirewall}</span>
			</button>
			<button
				type="button"
				className={`${s.mobileNavBtn} ${activeTab === 'sessions' ? s.mobileNavBtnActive : ''}`}
				onClick={() => onSelectTab('sessions')}
			>
				<Users size={16} />
				<span>{copy.navSessions}</span>
			</button>
			<button
				type="button"
				className={`${s.mobileNavBtn} ${activeTab === 'siem' ? s.mobileNavBtnActive : ''}`}
				onClick={() => onSelectTab('siem')}
			>
				<FileSearch size={16} />
				<span>SIEM</span>
			</button>
			<button
				type="button"
				className={`${s.mobileNavBtn} ${activeTab === 'inspection' ? s.mobileNavBtnActive : ''}`}
				onClick={() => onSelectTab('inspection')}
			>
				<ShieldCheck size={16} />
				<span>{copy.navInspection}</span>
			</button>
			{canManage && (
				<button
					type="button"
					className={`${s.mobileNavBtn} ${activeTab === 'audit' ? s.mobileNavBtnActive : ''}`}
					onClick={() => onSelectTab('audit')}
				>
					<History size={16} />
					<span>{copy.navAudit}</span>
				</button>
			)}
			<button
				type="button"
				className={`${s.mobileNavBtn} ${isLabTab(activeTab) ? s.mobileNavBtnActive : ''}`}
				onClick={() => onOpenLabTab(isLabTab(activeTab) ? activeTab : 'oauth')}
			>
				<FlaskConical size={16} />
				<span>Lab</span>
			</button>
		</nav>
	);
}
