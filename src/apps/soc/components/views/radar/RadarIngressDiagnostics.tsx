'use client';

import React from 'react';
import { Server, Cpu, Globe, ShieldAlert, ShieldCheck, Info } from 'lucide-react';
import type { IngressDiagnostics } from '../../../types';
import type { RadarMainCopy } from './i18nRadarMain';
import s from '../../../Soc.module.css';
import r from '../../../SocRadar.module.css';

interface RadarIngressDiagnosticsProps {
	diagnostics: IngressDiagnostics;
	callerIp: string | null;
	copy: RadarMainCopy;
}

function formatRecommendation(recommendation: string, copy: RadarMainCopy): string {
	if (recommendation.includes('Docker K\u00f6pr\u00fc') || recommendation.includes('Docker bridge')) {
		return copy.ingressBridgeRecText;
	}
	return recommendation;
}

export function RadarIngressDiagnostics({
	diagnostics,
	callerIp,
	copy,
}: RadarIngressDiagnosticsProps) {
	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<Server size={16} />
						{copy.ingressTitle}
					</h2>
					<p className={s.cardSub}>{copy.ingressSub}</p>
				</div>
				<span className={`${s.badge} ${diagnostics.isDockerBridgeOrPrivate ? s.badgeWarn : s.badgeSuccess}`}>
					{diagnostics.isDockerBridgeOrPrivate ? copy.ingressBadgeBridge : copy.ingressBadgeReal}
				</span>
			</div>

			<div className={r.ingressGrid}>
				<div className={r.ingressItem}>
					<span className={r.ingressLabel}>{copy.ingressEnv}</span>
					<span className={r.ingressValue}>
						<Cpu size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
						{diagnostics.isContainerEnvironment ? 'Docker (node:22-alpine)' : 'Host / Bare-Metal'}
					</span>
				</div>

				<div className={r.ingressItem}>
					<span className={r.ingressLabel}>{copy.ingressEdge}</span>
					<span className={r.ingressValue}>
						<Globe size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
						{diagnostics.detectedEdge.toUpperCase()}
					</span>
				</div>

				<div className={r.ingressItem}>
					<span className={r.ingressLabel}>{copy.ingressClientIp}</span>
					<span className={`${r.ingressValue} ${s.mono}`}>
						{diagnostics.detectedClientIp || callerIp || '—'}
					</span>
				</div>

				<div className={r.ingressItem}>
					<span className={r.ingressLabel}>{copy.ingressSelfLockout}</span>
					<span className={r.ingressValue}>
						{diagnostics.isDockerBridgeOrPrivate ? (
							<span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
								<ShieldAlert size={13} />
								{copy.ingressBridgeProtected}
							</span>
						) : (
							<span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
								<ShieldCheck size={13} />
								{copy.ingressDirectResolution}
							</span>
						)}
					</span>
				</div>
			</div>

			{diagnostics.recommendation && (
				<div
					style={{
						marginTop: 8,
						fontSize: 11.5,
						color: 'var(--text-secondary)',
						display: 'flex',
						alignItems: 'center',
						gap: 6,
					}}
				>
					<Info size={13} />
					<span>
						<strong>{copy.ingressRecommendationLabel}</strong>{' '}
						{formatRecommendation(diagnostics.recommendation, copy)}
					</span>
				</div>
			)}
		</section>
	);
}
