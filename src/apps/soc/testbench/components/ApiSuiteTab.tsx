'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, ArrowUpRight, Zap } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from './Testbench.module.css';
import type { ApiTestItem } from '../types';

interface ApiSuiteTabProps {
	items: ApiTestItem[];
	isRunning: boolean;
	onRunSuite: () => void;
}

export function ApiSuiteTab({ items, isRunning, onRunSuite }: ApiSuiteTabProps) {
	const { t, language } = useI18n();
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
						<CheckCircle2 size={15} color="#34c759" />
					</div>
					<div className={s.cardValue} style={{ color: '#34c759' }}>
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
							<React.Fragment key={item.id}>
								<tr
									style={{ cursor: 'pointer' }}
									onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
								>
									<td style={{ fontWeight: 600 }}>{language === 'en' && item.nameEn ? item.nameEn : item.name}</td>
									<td>
										<code
											style={{ fontSize: '11px', opacity: 0.85, cursor: 'text', userSelect: 'text' }}
											onDoubleClick={(e) => {
												e.stopPropagation();
												const selection = window.getSelection();
												if (!selection) return;
												const range = document.createRange();
												range.selectNodeContents(e.currentTarget);
												selection.removeAllRanges();
												selection.addRange(range);
											}}
										>
											{item.endpoint}
										</code>
									</td>
									<td>
										<span
											style={{
												fontSize: '11px',
												padding: '2px 7px',
												borderRadius: 5,
												background:
													item.requiredLevel === 'admin'
														? 'color-mix(in srgb, var(--danger, #d70015) 12%, transparent)'
														: 'color-mix(in srgb, var(--accent, #0071e3) 12%, transparent)',
												color: item.requiredLevel === 'admin' ? 'var(--danger, #d70015)' : 'var(--accent, #0071e3)',
												fontWeight: 600,
											}}
										>
											{item.requiredLevel}
										</span>
									</td>
									<td>
										<span
											className={`${s.badge} ${
												item.status && item.status >= 200 && item.status < 300
													? s.badgeOk
													: item.status === 403
													? s.badgeWarn
													: s.badgeFail
											}`}
										>
											{item.status} {item.statusText}
										</span>
									</td>
									<td>
										<span style={{ fontSize: '11px', opacity: 0.65 }}>
											{fill(t('tbApiExpectedRoleBased'), { code: item.expectedStatus })}
										</span>
									</td>
									<td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>
										{item.latencyMs} ms
									</td>
									<td style={{ textAlign: 'center' }}>
										{item.pass ? (
											<span
												style={{
													color: '#34c759',
													display: 'inline-flex',
													alignItems: 'center',
													gap: 5,
													fontSize: '11.5px',
													fontWeight: 700,
												}}
											>
												<CheckCircle2 size={14} /> {t('tbApiPass')}
											</span>
										) : (
											<span
												style={{
													color: '#ff3b30',
													display: 'inline-flex',
													alignItems: 'center',
													gap: 5,
													fontSize: '11.5px',
													fontWeight: 700,
												}}
											>
												<XCircle size={14} /> {t('tbApiFail')}
											</span>
										)}
									</td>
								</tr>
								{expandedId === item.id && (
									<tr>
										<td
											colSpan={7}
											style={{ background: 'var(--fill-softer, rgba(0, 0, 0, 0.04))', padding: '12px 16px' }}
										>
											<div
												style={{
													display: 'flex',
													justifyContent: 'space-between',
													marginBottom: 6,
												}}
											>
												<span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500 }}>
													{t('tbApiResponseSnippet')}
												</span>
												<a
													href={item.endpoint}
													target="_blank"
													rel="noreferrer noopener"
													style={{
														fontSize: '11.5px',
														color: 'var(--accent, #0071e3)',
														display: 'inline-flex',
														alignItems: 'center',
														gap: 3,
														textDecoration: 'none',
													}}
												>
													{t('tbApiOpenInBrowser')} <ArrowUpRight size={12} />
												</a>
											</div>
											<div className={s.codeBlock} style={{ maxHeight: 95 }}>
												{item.responseSnippet || t('tbApiNoBody')}
											</div>
										</td>
									</tr>
								)}
							</React.Fragment>
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
