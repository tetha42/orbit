'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Flame, ShieldCheck, Radio, Download, RefreshCw } from 'lucide-react';
import type { AppSecSummary, RouteSecurityReport } from '../../../types';
import type { INSPECTION_I18N } from './i18nInspection';
import { ApiRoutesTable } from './ApiRoutesTable';
import s from '../../../Soc.module.css';
import ins from '../../../SocInspection.module.css';

interface ApiSecurityPanelProps {
	appSecResult: AppSecSummary | null;
	filteredRoutes: RouteSecurityReport[];
	apiFilterCategory: string;
	setApiFilterCategory: (val: string) => void;
	apiSearch: string;
	setApiSearch: (val: string) => void;
	reportLoading: boolean;
	inspectionLoading: boolean;
	probingEndpoint: string | null;
	copy: (typeof INSPECTION_I18N)['en'] | (typeof INSPECTION_I18N)['tr'];
	onDownloadReport: () => Promise<void> | void;
	onTriggerApiScan: () => Promise<void> | void;
	onProbeRoute: (endpoint: string) => Promise<void> | void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onSelectData: (e: React.MouseEvent<HTMLElement>) => void;
}

export function ApiSecurityPanel({
	appSecResult,
	filteredRoutes,
	apiFilterCategory,
	setApiFilterCategory,
	apiSearch,
	setApiSearch,
	reportLoading,
	inspectionLoading,
	probingEndpoint,
	copy,
	onDownloadReport,
	onTriggerApiScan,
	onProbeRoute,
	onContainerDoubleClick,
	onSelectData,
}: ApiSecurityPanelProps) {
	const categories = [
		{ id: 'all', label: copy.catAll },
		{ id: 'auth', label: copy.catAuth },
		{ id: 'public', label: copy.catPublic },
		{ id: 'data', label: copy.catData },
		{ id: 'terminal', label: copy.catTerminal },
		{ id: 'soc', label: copy.catSoc },
		{ id: 'core', label: copy.catCore },
	];

	const gradeClass =
		appSecResult?.grade === 'A+' || appSecResult?.grade === 'A'
			? ins.scoreCircleA
			: appSecResult?.grade === 'B' || appSecResult?.grade === 'C'
			? ins.scoreCircleB
			: ins.scoreCircleF;

	return (
		<>
			<div className={ins.inspectionBanner}>
				<div className={ins.inspectionScoreCard}>
					<div className={`${ins.scoreCircle} ${gradeClass}`}>{appSecResult?.grade ?? 'A+'}</div>
					<div className={ins.scoreInfo}>
						<h3>
							{copy.matrixTitle}
							<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 8, opacity: 0.8 }}>
								({appSecResult ? `${appSecResult.score}/100` : '—'})
							</span>
						</h3>
						<p>{copy.matrixDesc}</p>
						<div style={{ marginTop: 8 }}>
							<span className={s.statTag}>
								<CheckCircle2 size={12} color="var(--success)" />
								{copy.passed} {appSecResult?.passed ?? 0}
							</span>
							<span className={s.statTag}>
								<AlertTriangle size={12} color="var(--warning)" />
								{copy.warnings} {appSecResult?.warned ?? 0}
							</span>
							<span className={s.statTag}>
								<ShieldAlert size={12} color="var(--danger)" />
								{copy.vulnerabilities} {appSecResult?.failed ?? 0}
							</span>
							<span className={s.statTag}>
								<Flame size={12} color="var(--danger)" />
								{copy.wafGuarded} {appSecResult?.wafActiveCount ?? 0}
							</span>
						</div>
						<div className={ins.deceptionPillBar}>
							<span className={ins.deceptionPill}>
								<ShieldCheck size={13} color="var(--success)" />
								<strong>{copy.canaryFleetLabel}</strong>
								<span>{copy.canaryFleetValue}</span>
							</span>
							<span className={ins.deceptionPill} style={{ opacity: 0.85 }}>
								<Radio size={12} color="var(--accent)" />
								<span>.env · .git · wp-login · phpmyadmin · actuator · .aws</span>
							</span>
						</div>
					</div>
				</div>

				<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
					<button
						type="button"
						className={s.actionBtn}
						onClick={() => void onDownloadReport()}
						disabled={reportLoading}
						title={copy.exportReportTitle}
					>
						<Download size={14} className={reportLoading ? s.spin : ''} />
						<span>{reportLoading ? copy.generatingReport : copy.exportReportBtn}</span>
					</button>
					<button
						type="button"
						className={s.actionBtn}
						onClick={() => void onTriggerApiScan()}
						disabled={inspectionLoading}
					>
						<RefreshCw size={14} className={inspectionLoading ? s.spin : ''} />
						<span>{inspectionLoading ? copy.scanningEndpoints : copy.runScanBtn}</span>
					</button>
				</div>
			</div>

			<div className={s.formRow} style={{ marginBottom: 14 }}>
				<div className={ins.filterGroup}>
					{categories.map((cat) => {
						const count =
							cat.id === 'all'
								? appSecResult?.routes.length
								: appSecResult?.routes.filter((r) => r.category === cat.id).length;
						return (
							<button
								key={cat.id}
								type="button"
								className={`${ins.filterBtn} ${apiFilterCategory === cat.id ? ins.filterBtnActive : ''}`}
								onClick={() => setApiFilterCategory(cat.id)}
							>
								<span>{cat.label}</span>
								{typeof count === 'number' && (
									<span
										style={{
											fontSize: 10,
											fontWeight: 700,
											marginLeft: 5,
											padding: '1px 5px',
											borderRadius: 999,
											background:
												apiFilterCategory === cat.id
													? 'color-mix(in srgb, var(--accent) 15%, transparent)'
													: 'var(--fill-soft, rgba(0, 0, 0, 0.08))',
										}}
									>
										{count}
									</span>
								)}
							</button>
						);
					})}
				</div>

				<input
					type="text"
					className={`${s.input} ${s.inputGrow}`}
					placeholder={copy.filterEndpointsPlaceholder}
					value={apiSearch}
					onChange={(e) => setApiSearch(e.target.value)}
				/>
			</div>

			<ApiRoutesTable
				routes={filteredRoutes}
				probingEndpoint={probingEndpoint}
				copy={copy}
				onContainerDoubleClick={onContainerDoubleClick}
				onSelectData={onSelectData}
				onProbeRoute={onProbeRoute}
			/>
		</>
	);
}
