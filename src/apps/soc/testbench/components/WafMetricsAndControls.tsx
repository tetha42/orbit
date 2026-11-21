'use client';

import React from 'react';
import { Play, Flame, ShieldCheck, Activity } from 'lucide-react';
import s from './Testbench.module.css';
import type { WafSimulatorCopy } from './i18nWafSimulator';

interface WafMetricsAndControlsProps {
	copy: WafSimulatorCopy;
	scenarioCount: number;
	totalTested: number;
	totalBlocked: number;
	blockRate: number;
	avgLatency: number;
	isRunning: boolean;
	onRunAll: () => void;
}

export function WafMetricsAndControls({
	copy,
	scenarioCount,
	totalTested,
	totalBlocked,
	blockRate,
	avgLatency,
	isRunning,
	onRunAll,
}: WafMetricsAndControlsProps) {
	return (
		<>
			{/* Top Metric Cards */}
			<div className={s.grid}>
				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{copy.attackScenariosTitle}</span>
						<Flame size={15} color="var(--accent)" />
					</div>
					<div className={s.cardValue}>{scenarioCount}</div>
					<div className={s.cardSub}>{copy.attackScenariosSub}</div>
				</div>

				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{copy.interceptionRateTitle}</span>
						<ShieldCheck size={15} color="var(--success)" />
					</div>
					<div className={s.cardValue} style={{ color: blockRate === 100 ? 'var(--success)' : 'var(--warning)' }}>
						{totalTested > 0 ? `${blockRate}%` : '—'}
					</div>
					<div className={s.cardSub}>
						{totalTested > 0
							? copy.attacksRepelled(totalBlocked, totalTested)
							: copy.readyToTest}
					</div>
				</div>

				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{copy.meanLatencyTitle}</span>
						<Activity size={15} color="var(--accent)" />
					</div>
					<div className={s.cardValue}>
						{avgLatency > 0 ? `${avgLatency} ms` : '—'}
					</div>
					<div className={s.cardSub}>{copy.meanLatencySub}</div>
				</div>
			</div>

			{/* Control Bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					gap: '12px',
					padding: '12px 16px',
					borderRadius: '8px',
					background: 'var(--fill-soft, rgba(0,0,0,0.03))',
					border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
				}}
			>
				<div>
					<div style={{ fontWeight: 700, fontSize: '13px' }}>{copy.controlTitle}</div>
					<div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
						{copy.controlDesc}
					</div>
				</div>

				<button
					type="button"
					className={s.btnPrimary}
					onClick={onRunAll}
					disabled={isRunning}
					style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
				>
					<Play size={13} />
					<span>{isRunning ? copy.firingSuite : copy.launchSuite}</span>
				</button>
			</div>
		</>
	);
}
