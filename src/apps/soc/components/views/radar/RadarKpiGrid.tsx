'use client';

import React from 'react';
import { Activity, Ban, ShieldAlert, Lock, Flame, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { SocOverviewData, SocTab } from '../../../types';
import type { RadarMainCopy } from './i18nRadarMain';
import s from '../../../SocRadar.module.css';

interface RadarKpiGridProps {
	overview: SocOverviewData | null;
	sessionsCount: number;
	callerIp: string | null;
	copy: RadarMainCopy;
	onOpenFirewall: (tab: SocTab) => void;
}

export function RadarKpiGrid({ overview, sessionsCount, callerIp, copy, onOpenFirewall }: RadarKpiGridProps) {
	return (
		<div className={s.kpiGrid}>
			<div className={s.kpiCard}>
				<div className={s.kpiHeader}>
					<span>{copy.kpiQuarantinedIps}</span>
					<Ban size={15} color="var(--danger)" />
				</div>
				<div className={s.kpiValue} style={{ color: 'var(--danger)' }}>
					{overview?.metrics.activeBansCount ?? 0}
				</div>
				<div className={s.kpiSub}>
					{overview?.metrics.whitelistedCount ?? 0} {copy.kpiWhitelistedSuffix}
				</div>
			</div>

			<div className={s.kpiCard}>
				<div className={s.kpiHeader}>
					<span>{copy.kpiSecEvents24h}</span>
					<ShieldAlert size={15} color="var(--warning)" />
				</div>
				<div className={s.kpiValue}>{overview?.metrics.securityEvents24h ?? 0}</div>
				<div className={s.kpiSub}>{copy.kpiSecEventsSub}</div>
			</div>

			<div className={s.kpiCard}>
				<div className={s.kpiHeader}>
					<span>{copy.kpiAuth24h}</span>
					<Lock size={15} color="var(--warning)" />
				</div>
				<div className={s.kpiValue}>{overview?.metrics.authFailures24h ?? 0}</div>
				<div className={s.kpiSub}>{copy.kpiAuthSub}</div>
			</div>

			<div className={s.kpiCard}>
				<div className={s.kpiHeader}>
					<span>{copy.kpiWafTitle}</span>
					<Flame size={15} color="var(--danger)" />
				</div>
				<div className={s.kpiValue} style={{ color: 'var(--danger)' }}>
					{overview?.metrics.csrfAndIdor24h ?? 0}
				</div>
				<div className={s.kpiSub}>{copy.kpiWafSub}</div>
			</div>

			<div className={s.kpiCard}>
				<div className={s.kpiHeader}>
					<span>{copy.kpiSessionAnomalies}</span>
					<AlertTriangle size={15} color="var(--warning)" />
				</div>
				<div className={s.kpiValue}>{overview?.metrics.sessionAnomalies24h ?? 0}</div>
				<div className={s.kpiSub}>{copy.kpiSessionAnomaliesSub}</div>
			</div>

			<div className={s.kpiCard}>
				<div className={s.kpiHeader}>
					<span>{copy.kpiActiveSessions}</span>
					<ShieldCheck size={15} color="var(--success)" />
				</div>
				<div className={s.kpiValue} style={{ color: 'var(--success)' }}>
					{overview?.metrics.activeSessionsCount ?? sessionsCount}
				</div>
				<div className={s.kpiSub}>
					{copy.kpiYourIpPrefix} {callerIp || copy.kpiLocalIp}
				</div>
			</div>

			<div
				className={s.kpiCard}
				style={{ cursor: 'pointer' }}
				onClick={() => onOpenFirewall('firewall')}
				role="button"
				tabIndex={0}
			>
				<div className={s.kpiHeader}>
					<span>{copy.kpiRateLimits}</span>
					<Activity size={15} color="var(--accent)" />
				</div>
				<div className={s.kpiValue} style={{ color: 'var(--accent)' }}>
					{overview?.metrics.activeRateLimitsCount ?? overview?.metrics.activeRateLimits?.length ?? 0}
				</div>
				<div className={s.kpiSub}>{copy.kpiRateLimitsSub}</div>
			</div>
		</div>
	);
}
