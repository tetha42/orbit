'use client';

import React, { useState } from 'react';
import { Database, HardDrive, Cpu, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { fill } from '@/lib/text';
import type { SocOverviewData } from '../../../types';
import type { RadarStreamCopy } from './i18nRadarStream';
import s from '../../../Soc.module.css';
import r from '../../../SocRadar.module.css';

interface RadarSystemTelemetryProps {
	telemetry: NonNullable<SocOverviewData['systemTelemetry']>;
	copy: RadarStreamCopy;
}

export function RadarSystemTelemetry({ telemetry, copy }: RadarSystemTelemetryProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<Database size={16} />
						{copy.telemetryTitle}
					</h2>
					<p className={s.cardSub}>{copy.telemetrySub}</p>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<span className={`${s.badge} ${telemetry.pgPool.waitingCount > 0 ? s.badgeWarn : s.badgeSuccess}`}>
						{telemetry.pgPool.waitingCount > 0 ? 'QUEUE DELAY' : 'POOL HEALTHY'}
					</span>
					<button
						type="button"
						className={s.actionBtn}
						style={{ height: 24, padding: '0 8px', fontSize: 11 }}
						onClick={() => setExpanded((prev) => !prev)}
					>
						{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
						<span>{expanded ? copy.collapse : copy.expand}</span>
					</button>
				</div>
			</div>

			{expanded ? (
				<div className={r.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
					<div className={r.kpiCard}>
						<div className={r.kpiHeader}>
							<span>{copy.pgPoolLabel}</span>
							<Database size={14} color="var(--accent)" />
						</div>
						<div className={r.kpiValue} style={{ color: 'var(--accent)' }}>
							{telemetry.pgPool.totalCount} / {telemetry.pgPool.max}
						</div>
						<div className={r.kpiSub}>
							{fill(copy.pgPoolSubTemplate, {
								idle: telemetry.pgPool.idleCount,
								waiting: telemetry.pgPool.waitingCount,
							})}
						</div>
					</div>

					<div className={r.kpiCard}>
						<div className={r.kpiHeader}>
							<span>{copy.heapLabel}</span>
							<HardDrive size={14} color="#8b5cf6" />
						</div>
						<div className={r.kpiValue} style={{ color: '#8b5cf6' }}>
							{(telemetry.memory.processHeapUsed / 1024 / 1024).toFixed(1)} MB
						</div>
						<div className={r.kpiSub}>RSS: {(telemetry.memory.processRss / 1024 / 1024).toFixed(1)} MB</div>
					</div>

					<div className={r.kpiCard}>
						<div className={r.kpiHeader}>
							<span>{copy.ramLabel}</span>
							<Cpu size={14} color="var(--success)" />
						</div>
						<div className={r.kpiValue} style={{ color: 'var(--success)' }}>
							{(telemetry.memory.osUsed / 1024 / 1024 / 1024).toFixed(2)} GB
						</div>
						<div className={r.kpiSub}>
							{copy.totalRamPrefix} {(telemetry.memory.osTotal / 1024 / 1024 / 1024).toFixed(2)} GB
						</div>
					</div>

					<div className={r.kpiCard}>
						<div className={r.kpiHeader}>
							<span>{copy.cpuLabel}</span>
							<Activity size={14} color="var(--warning)" />
						</div>
						<div className={r.kpiValue} style={{ color: 'var(--warning)' }}>
							{telemetry.cpu.loadAvg.map((l) => l.toFixed(2)).join(' · ')}
						</div>
						<div className={r.kpiSub}>
							{copy.uptimePrefix} {Math.floor(telemetry.cpu.uptime / 3600)}h {Math.floor((telemetry.cpu.uptime % 3600) / 60)}m
						</div>
					</div>
				</div>
			) : (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 16,
						fontSize: 11.5,
						color: 'var(--text-secondary)',
						padding: '2px 0',
					}}
				>
					<span>
						<strong>PG Pool:</strong> {telemetry.pgPool.totalCount}/{telemetry.pgPool.max} (
						{telemetry.pgPool.idleCount} idle)
					</span>
					<span>
						<strong>Heap:</strong> {(telemetry.memory.processHeapUsed / 1024 / 1024).toFixed(1)} MB
					</span>
					<span>
						<strong>RAM:</strong> {(telemetry.memory.osUsed / 1024 / 1024 / 1024).toFixed(2)} GB /{' '}
						{(telemetry.memory.osTotal / 1024 / 1024 / 1024).toFixed(2)} GB
					</span>
					<span>
						<strong>Load:</strong> {telemetry.cpu.loadAvg[0]?.toFixed(2)}
					</span>
				</div>
			)}
		</section>
	);
}
