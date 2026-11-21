'use client';

import React from 'react';
import { Bell, Lock, Unlock, RotateCcw } from 'lucide-react';
import s from './SocSidebar.module.css';
import type { SidebarCopy } from './i18nSidebar';

type DefconLevel = 1 | 2 | 3 | 4 | 5;

const DEFCON_DOT_CLASS: Record<DefconLevel, string> = {
	1: s.defconDot1,
	2: s.defconDot2,
	3: s.defconDot3,
	4: s.defconDot4,
	5: s.defconDot5,
};

interface SidebarFooterProps {
	copy: SidebarCopy;
	defcon: DefconLevel;
	canManage: boolean;
	isLockdownActive: boolean;
	isResettingDefcon: boolean;
	onResetDefcon: () => void;
	onToggleLockdown: () => Promise<void> | void;
	onOpenWebhooks: () => void;
}

export function SidebarFooter({
	copy,
	defcon,
	canManage,
	isLockdownActive,
	isResettingDefcon,
	onResetDefcon,
	onToggleLockdown,
	onOpenWebhooks,
}: SidebarFooterProps) {
	return (
		<div className={s.footer}>
			<div className={s.defconRow}>
				<div className={s.defconPill}>
					<span className={`${s.defconDot} ${DEFCON_DOT_CLASS[defcon]}`} />
					<span>DEFCON {defcon}</span>
				</div>
				{canManage && defcon < 5 && (
					<button
						type="button"
						className={s.resetDefconBtn}
						onClick={onResetDefcon}
						disabled={isResettingDefcon}
						title={copy.resetDefconTitle}
					>
						<RotateCcw size={11} />
						<span>{copy.resetLabel}</span>
					</button>
				)}
			</div>

			<div className={s.footerActions}>
				{canManage && (
					<button
						type="button"
						className={`${s.lockdownBtn} ${isLockdownActive ? s.lockdownBtnActive : ''}`}
						onClick={() => void onToggleLockdown()}
						title={isLockdownActive ? copy.lockdownActiveTitle : copy.lockdownIdleTitle}
					>
						{isLockdownActive ? <Lock size={12} /> : <Unlock size={12} />}
						<span>{isLockdownActive ? copy.lockdownOnLabel : copy.lockdownOffLabel}</span>
					</button>
				)}

				{canManage && (
					<button
						type="button"
						className={s.iconBtn}
						onClick={onOpenWebhooks}
						title={copy.webhookTitle}
					>
						<Bell size={13} />
					</button>
				)}
			</div>
		</div>
	);
}
