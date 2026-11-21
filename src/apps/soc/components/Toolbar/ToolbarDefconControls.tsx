'use client';

import React from 'react';
import { Lock, Unlock, ShieldCheck } from 'lucide-react';
import s from './SocToolbar.module.css';
import type { DefconLevel, ToolbarCopy } from './i18nToolbar';

const DEFCON_DOT_CLASS: Record<DefconLevel, string> = {
	1: s.defconDot1,
	2: s.defconDot2,
	3: s.defconDot3,
	4: s.defconDot4,
	5: s.defconDot5,
};

interface ToolbarDefconControlsProps {
	copy: ToolbarCopy;
	defcon: DefconLevel;
	canManage: boolean;
	isResettingDefcon: boolean;
	isLockdownActive: boolean;
	onResetDefcon: () => void;
	onToggleLockdown: () => Promise<void> | void;
}

export function ToolbarDefconControls({
	copy,
	defcon,
	canManage,
	isResettingDefcon,
	isLockdownActive,
	onResetDefcon,
	onToggleLockdown,
}: ToolbarDefconControlsProps) {
	return (
		<>
			{/* DEFCON Posture Pill */}
			<div className={s.defconPill} title={copy.defconTitle(defcon)}>
				<span className={`${s.defconDot} ${DEFCON_DOT_CLASS[defcon]}`} />
				<span>DEFCON {defcon}</span>
				{canManage && defcon < 5 && (
					<button
						type="button"
						className={s.toolbarResetDefcon}
						onClick={onResetDefcon}
						disabled={isResettingDefcon}
						title={copy.resetDefconTitle}
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
					onClick={() => void onToggleLockdown()}
					title={isLockdownActive ? copy.lockdownActiveTitle : copy.lockdownIdleTitle}
				>
					{isLockdownActive ? <Lock size={12} /> : <Unlock size={12} />}
					<span>{isLockdownActive ? copy.lockdownOnLabel : copy.lockdownOffLabel}</span>
				</button>
			)}
		</>
	);
}
