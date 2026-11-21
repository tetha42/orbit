'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, Zap } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { ApiSuiteRow } from './ApiSuiteRow';
import s from './Testbench.module.css';
import type { ApiTestItem } from '../types';

interface ApiSuiteTabProps {
	items: ApiTestItem[];
	isRunning: boolean;
	onRunSuite: () => void;
}

export function ApiSuiteTab({ items, isRunning, onRunSuite }: ApiSuiteTabProps) {
	const { t } = useI18n();
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const total = items.length;
	const passed = items.filter((i) => i.pass).length;
	const failed = total - passed;
	const avgLatency =
		total > 0 ? Math.round(items.reduce((acc, i) => acc + (i.latencyMs ?? 0), 0) / total) : 0;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			{/* Top Bar Summary */}
			<div className={s.grid}>
				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{t('tbApiEndpoints')}</span>
						<Zap size={15} color="var(--accent)" />
					</div>
					<div className={s.cardValue}>{total}</div>
					<div className={s.cardSub}>{t('tbApiEndpointsSub')}</div>
				</div>

				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{t('tbApiPermMatch')}</span>
						<CheckCircle2 size={15} color="var(--success)" />
					</div>
					<div className={s.cardValue} style={{ color: 'var(--success)' }}>
						{passed} / {total}
					</div>
					<div className={s.cardSub}>
						{failed > 0
							? fill(t('tbApiPermMatchMismatch'), { failed })
							: t('tbApiPermMatchPerfect')}
					</div>
				</div>

				<div className={s.card}>
					<div className={s.cardHeader}>
						<span className={s.cardTitle}>{t('tbApiAvgLatency')}</span>
						<span style={{ fontSize: '11px', opacity: 0.6 }}>Ping</span>
					</div>
					<div className={s.cardValue}>{avgLatency} ms</div>
					<div className={s.cardSub}>{t('tbApiLatencySub')}</div>
				</div>
			</div>

			{/* Actions */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
				<div>
					<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
						{t('tbApiSuiteTitle')}
					</h3>
					<p style={{ margin: '3px 0 0', fontSize: '12px', opacity: 0.65 }}>
						{t('tbApiSuiteDesc')}
					</p>
				</div>

				<button
					type="button"
					className={s.btnAccentLg}
					disabled={isRunning}
					onClick={onRunSuite}
				>
					<RefreshCw size={14} className={isRunning ? s.spin : ''} />
					<span>{isRunning ? t('tbApiRunning') : t('tbApiRunSuite')}</span>
				</button>
			</div>

			{/* Table */}
			<div className={s.tableContainer}>
				<table className={s.table}>
					<thead>
						<tr>
							<th>{t('tbApiThModule')}</th>
							<th>{t('tbApiThEndpoint')}</th>
							<th>{t('tbApiThRequiredLevel')}</th>
							<th>{t('tbApiThReceivedHttp')}</th>
							<th>{t('tbApiThExpectedHttp')}</th>
							<th>{t('tbApiThLatency')}</th>
							<th style={{ textAlign: 'center' }}>{t('tbApiThStatus')}</th>
						</tr>
					</thead>
					<tbody>
						{items.map((item) => (
							<ApiSuiteRow
								key={item.id}
								item={item}
								expanded={expandedId === item.id}
								onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
							/>
						))}
						{items.length === 0 && (
							<tr>
								<td colSpan={7} style={{ textAlign: 'center', padding: '36px', opacity: 0.65 }}>
									{isRunning ? t('tbApiRunning') : t('tbApiEmptyClick')}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
