'use client';

import React from 'react';
import { ShieldAlert, UserX, HardDrive, Lock } from 'lucide-react';
import type { EmergencyKillSwitches } from '../../../types';
import type { RadarMainCopy } from './i18nRadarMain';
import s from '../../../Soc.module.css';
import r from '../../../SocRadar.module.css';

interface RadarKillSwitchesProps {
	switches?: EmergencyKillSwitches;
	canManage: boolean;
	isSubmitting: boolean;
	copy: RadarMainCopy;
	onToggle: (key: keyof EmergencyKillSwitches, nextValue: boolean) => Promise<void>;
}

export function RadarKillSwitches({ switches, canManage, isSubmitting, copy, onToggle }: RadarKillSwitchesProps) {
	const anyActive = Boolean(switches?.disableRegistrations || switches?.disableUploads || switches?.passkeyOnly);

	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<ShieldAlert size={16} />
						{copy.killTitle}
					</h2>
					<p className={s.cardSub}>{copy.killSub}</p>
				</div>
				<span className={`${s.badge} ${anyActive ? s.badgeDanger : s.badgeSuccess}`}>
					{anyActive ? copy.killShieldActive : copy.killNormal}
				</span>
			</div>

			<div className={r.killSwitchesGrid}>
				<div className={`${r.killSwitchCard} ${switches?.disableRegistrations ? r.killSwitchCardActive : ''}`}>
					<div className={r.killSwitchInfo}>
						<div className={r.killSwitchTitle}>
							<UserX size={15} />
							{copy.killRegTitle}
						</div>
						<div className={r.killSwitchDesc}>{copy.killRegDesc}</div>
					</div>
					{canManage && (
						<button
							type="button"
							className={`${r.switchToggleBtn} ${switches?.disableRegistrations ? r.switchToggleBtnActive : ''}`}
							onClick={() => void onToggle('disableRegistrations', !switches?.disableRegistrations)}
							disabled={isSubmitting}
						>
							{switches?.disableRegistrations ? copy.killState503On : copy.killStateOff}
						</button>
					)}
				</div>

				<div className={`${r.killSwitchCard} ${switches?.disableUploads ? r.killSwitchCardActive : ''}`}>
					<div className={r.killSwitchInfo}>
						<div className={r.killSwitchTitle}>
							<HardDrive size={15} />
							{copy.killUploadTitle}
						</div>
						<div className={r.killSwitchDesc}>{copy.killUploadDesc}</div>
					</div>
					{canManage && (
						<button
							type="button"
							className={`${r.switchToggleBtn} ${switches?.disableUploads ? r.switchToggleBtnActive : ''}`}
							onClick={() => void onToggle('disableUploads', !switches?.disableUploads)}
							disabled={isSubmitting}
						>
							{switches?.disableUploads ? copy.killState503On : copy.killStateOff}
						</button>
					)}
				</div>

				<div className={`${r.killSwitchCard} ${switches?.passkeyOnly ? r.killSwitchCardActive : ''}`}>
					<div className={r.killSwitchInfo}>
						<div className={r.killSwitchTitle}>
							<Lock size={15} />
							{copy.killPasskeyTitle}
						</div>
						<div className={r.killSwitchDesc}>{copy.killPasskeyDesc}</div>
					</div>
					{canManage && (
						<button
							type="button"
							className={`${r.switchToggleBtn} ${switches?.passkeyOnly ? r.switchToggleBtnActive : ''}`}
							onClick={() => void onToggle('passkeyOnly', !switches?.passkeyOnly)}
							disabled={isSubmitting}
						>
							{switches?.passkeyOnly ? copy.killState403On : copy.killStateOff}
						</button>
					)}
				</div>
			</div>
		</section>
	);
}
