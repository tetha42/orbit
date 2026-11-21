'use client';

import React from 'react';
import { Ban, ShieldCheck, Globe } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime } from '../../../types';
import type { InspectorIpData } from '../../../types';
import { formatSocAlertMessage } from '../../../utils/i18nAlertLocalization';
import type { INSPECTOR_I18N } from '../i18nInspector';
import s from '../SocInspector.module.css';

interface IpInspectorProps {
	data: InspectorIpData;
	language: Language;
	canManage: boolean;
	isSubmitting: boolean;
	copy: (typeof INSPECTOR_I18N)['en'] | (typeof INSPECTOR_I18N)['tr'];
	onQuickBan: (ip: string, reason: string) => Promise<void> | void;
	onUnban: (ip: string) => Promise<void> | void;
	onFilterSiemIp: (ip: string) => void;
}

export function IpInspector({
	data,
	language,
	canManage,
	isSubmitting,
	copy,
	onQuickBan,
	onUnban,
	onFilterSiemIp,
}: IpInspectorProps) {
	const { ip, threatIntel, banInfo, attackerInfo } = data;
	const threatScore = banInfo?.threatScore ?? attackerInfo?.threatScore ?? 0;
	const isBanned = banInfo?.status === 'ban' || attackerInfo?.status === 'ban';
	const scoreColor =
		threatScore >= 75
			? 'var(--danger)'
			: threatScore >= 40
			? 'var(--warning)'
			: 'var(--text-primary)';
	const barColor =
		threatScore >= 75
			? 'var(--danger)'
			: threatScore >= 40
			? 'var(--warning)'
			: 'var(--accent)';

	return (
		<>
			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.threatScore}</span>
					<span
						className={`${s.badge} ${
							threatScore >= 75 ? s.badgeDanger : threatScore >= 40 ? s.badgeWarn : s.badgeNeutral
						}`}
					>
						{threatScore >= 75 ? 'HIGH RISK' : threatScore >= 40 ? 'SUSPICIOUS' : 'NORMAL'}
					</span>
				</div>
				<div className={s.scoreRow}>
					<span className={s.scoreValue} style={{ color: scoreColor }}>
						{threatScore}
						<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}>/100</span>
					</span>
					<div className={s.scoreBarWrap}>
						<div
							className={s.scoreBarFill}
							style={{ width: `${Math.min(100, threatScore)}%`, background: barColor }}
						/>
					</div>
				</div>
			</div>

			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.networkIntel}</span>
				</div>
				<div className={s.gridProps}>
					<span className={s.propLabel}>{copy.providerIsp}</span>
					<span className={s.propValue}>{threatIntel?.provider || 'Unknown Provider'}</span>

					<span className={s.propLabel}>{copy.datacenter}</span>
					<span className={s.propValue}>
						{threatIntel?.isDatacenter ? copy.datacenterYes : copy.datacenterNo}
					</span>

					<span className={s.propLabel}>{copy.torProxy}</span>
					<span className={s.propValue}>{threatIntel?.isTor ? copy.torExit : copy.no}</span>

					{attackerInfo && (
						<>
							<span className={s.propLabel}>{copy.totalStrikes}</span>
							<span className={s.propValue}>{attackerInfo.eventCount}</span>

							<span className={s.propLabel}>{copy.lastSeen}</span>
							<span className={s.propValue}>{formatDateTime(attackerInfo.lastSeen, language)}</span>
						</>
					)}
				</div>
			</div>

			{banInfo && (
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{copy.quarantineRule}</span>
						<span className={`${s.badge} ${banInfo.status === 'ban' ? s.badgeDanger : s.badgeSuccess}`}>
							{banInfo.status.toUpperCase()}
						</span>
					</div>
					<div className={s.gridProps}>
						<span className={s.propLabel}>{copy.reason}</span>
						<span className={s.propValue}>{formatSocAlertMessage(banInfo.reason, language)}</span>

						<span className={s.propLabel}>{copy.expiresAt}</span>
						<span className={s.propValue}>
							{banInfo.expiresAt ? formatDateTime(banInfo.expiresAt, language) : copy.permanent}
						</span>
					</div>
				</div>
			)}

			{canManage && (
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{copy.responseActions}</span>
					</div>
					<div className={s.actionGroup}>
						{isBanned ? (
							<button
								type="button"
								className={`${s.containmentBtn} ${s.containmentBtnPrimary}`}
								onClick={() => void onUnban(ip)}
								disabled={isSubmitting}
							>
								<ShieldCheck size={13} />
								<span>{copy.liftQuarantine}</span>
							</button>
						) : (
							<button
								type="button"
								className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
								onClick={() => void onQuickBan(ip, 'Manual quarantine via Threat Inspector')}
								disabled={isSubmitting}
							>
								<Ban size={13} />
								<span>{copy.quarantine24h}</span>
							</button>
						)}
						<button
							type="button"
							className={s.containmentBtn}
							onClick={() => onFilterSiemIp(ip)}
						>
							<Globe size={13} />
							<span>{copy.filterAllInSiem}</span>
						</button>
					</div>
				</div>
			)}
		</>
	);
}
