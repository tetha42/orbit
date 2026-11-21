'use client';

import React from 'react';
import { Play, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { FirewallCopy } from './i18nFirewall';
import type { SimResult } from './useFirewallRules';
import s from '../../../Soc.module.css';

interface RuleSimulatorBenchProps {
	simMethod: string;
	setSimMethod: (v: string) => void;
	simPath: string;
	setSimPath: (v: string) => void;
	simIp: string;
	setSimIp: (v: string) => void;
	simHeaders: string;
	setSimHeaders: (v: string) => void;
	simBody: string;
	setSimBody: (v: string) => void;
	isSimulating: boolean;
	simResult: SimResult | null;
	copy: FirewallCopy;
	onRun: () => Promise<void>;
	onClose: () => void;
}

export function RuleSimulatorBench({
	simMethod,
	setSimMethod,
	simPath,
	setSimPath,
	simIp,
	setSimIp,
	simHeaders,
	setSimHeaders,
	simBody,
	setSimBody,
	isSimulating,
	simResult,
	copy,
	onRun,
	onClose,
}: RuleSimulatorBenchProps) {
	const { t } = useI18n();
	return (
		<section className={s.card} style={{ borderLeft: '3px solid var(--accent)' }}>
			<div className={s.cardHeader}>
				<div>
					<h3 className={s.cardTitle}>
						<Play size={14} />
						{copy.simTitle}
					</h3>
					<p className={s.cardSub}>{copy.simSub}</p>
				</div>
				<button type="button" className={s.actionBtn} onClick={onClose} aria-label={t('close')} style={{ padding: '4px 8px' }}>
					<X size={12} />
				</button>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
				<div>
					<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('socRuleCondMethod')}</label>
					<select className={s.select} value={simMethod} onChange={(e) => setSimMethod(e.target.value)} style={{ width: '100%' }}>
						<option value="GET">GET</option>
						<option value="POST">POST</option>
						<option value="PUT">PUT</option>
						<option value="DELETE">DELETE</option>
						<option value="PATCH">PATCH</option>
					</select>
				</div>

				<div>
					<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('socSimPathLabel')}</label>
					<input
						type="text"
						className={`${s.input} ${s.mono}`}
						value={simPath}
						onChange={(e) => setSimPath(e.target.value)}
						placeholder="/api/admin/users"
						style={{ width: '100%' }}
					/>
				</div>

				<div>
					<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('socSimClientIpLabel')}</label>
					<input
						type="text"
						className={`${s.input} ${s.mono}`}
						value={simIp}
						onChange={(e) => setSimIp(e.target.value)}
						placeholder="198.51.100.42"
						style={{ width: '100%' }}
					/>
				</div>

				<div>
					<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('socSimHeadersLabel')}</label>
					<input
						type="text"
						className={`${s.input} ${s.mono}`}
						value={simHeaders}
						onChange={(e) => setSimHeaders(e.target.value)}
						placeholder="user-agent: bot"
						style={{ width: '100%' }}
					/>
				</div>

				<div>
					<label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('socSimBodyLabel')}</label>
					<input
						type="text"
						className={`${s.input} ${s.mono}`}
						value={simBody}
						onChange={(e) => setSimBody(e.target.value)}
						placeholder={t('socSimBodyPh')}
						style={{ width: '100%' }}
					/>
				</div>
			</div>

			<div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
				<button
					type="button"
					className={`${s.actionBtn} ${s.actionBtnPrimary}`}
					onClick={() => void onRun()}
					disabled={isSimulating}
					style={{ padding: '8px 16px' }}
				>
					<Play size={13} />
					<span>{isSimulating ? copy.simEvaluating : copy.simRun}</span>
				</button>

				{simResult && (
					<div
						style={{
							display: 'flex',
							gap: 12,
							alignItems: 'center',
							padding: '6px 12px',
							background: 'var(--card-bg, rgba(0,0,0,0.04))',
							borderRadius: 8,
							fontSize: 12,
						}}
					>
						<span>
							{copy.simMatchedLabel}{' '}
							<strong style={{ color: simResult.matched ? 'var(--danger)' : 'var(--success)' }}>
								{simResult.matched ? copy.simYes : copy.simNoPass}
							</strong>
						</span>

						{simResult.ruleName && (
							<span>
								{copy.simRuleLabel} <strong>{simResult.ruleName}</strong>
							</span>
						)}

						<span>
							{copy.simActionLabel}{' '}
							<span
								className={`${s.badge} ${
									simResult.action === 'block'
										? s.badgeDanger
										: simResult.action === 'allow'
										? s.badgeSuccess
										: s.badgeWarn
								}`}
							>
								{simResult.action.toUpperCase()}
							</span>
						</span>

						{simResult.evaluationTimeUs !== undefined && (
							<span className={s.mono} style={{ color: 'var(--text-secondary)' }}>
								{simResult.evaluationTimeUs} µs
							</span>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
