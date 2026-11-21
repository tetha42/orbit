'use client';

import React from 'react';
import { Check, AlertTriangle, XCircle, Flame, Activity } from 'lucide-react';
import type { RouteSecurityReport } from '../../../types';
import type { INSPECTION_I18N } from './i18nInspection';
import s from '../../../Soc.module.css';
import ins from '../../../SocInspection.module.css';

interface ApiRoutesTableProps {
	routes: RouteSecurityReport[];
	probingEndpoint: string | null;
	copy: (typeof INSPECTION_I18N)['en'] | (typeof INSPECTION_I18N)['tr'];
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onSelectData: (e: React.MouseEvent<HTMLElement>) => void;
	onProbeRoute: (endpoint: string) => Promise<void> | void;
}

export function ApiRoutesTable({
	routes,
	probingEndpoint,
	copy,
	onContainerDoubleClick,
	onSelectData,
	onProbeRoute,
}: ApiRoutesTableProps) {
	return (
		<div className={s.tableContainer} onDoubleClick={onContainerDoubleClick}>
			<table className={s.table}>
				<thead>
					<tr>
						<th>{copy.colEndpoint}</th>
						<th>{copy.colCategory}</th>
						<th>{copy.colAuthBarrier}</th>
						<th>{copy.colWafIntercept}</th>
						<th>{copy.colHeaders}</th>
						<th>{copy.colStatus}</th>
						<th>{copy.colLatency}</th>
						<th style={{ textAlign: 'right' }}>{copy.colAction}</th>
					</tr>
				</thead>
				<tbody>
					{routes.map((r) => (
						<tr key={r.endpoint}>
							<td className={s.mono} style={{ fontWeight: 600 }}>
								<span
									data-type="endpoint"
									className={s.selectableData}
									onDoubleClick={onSelectData}
									title={copy.hintSelectEndpoint}
								>
									{r.endpoint}
								</span>
							</td>
							<td>
								<span className={s.statTag}>{r.category}</span>
							</td>
							<td>
								{r.isPublicExpected ? (
									<span className={s.statTag} style={{ opacity: 0.85 }}>
										{copy.publicEndpoint}
									</span>
								) : r.authGuarded || [401, 403, 404].includes(r.unauthStatus) ? (
									<span className={ins.badgePass}>
										<Check size={11} />
										HTTP {r.unauthStatus} ({copy.guarded})
									</span>
								) : r.unauthStatus === 0 ? (
									<span className={ins.badgeWarn}>
										<AlertTriangle size={11} />
										{copy.probeFailed}
									</span>
								) : (
									<span className={s.badgeFail}>
										<XCircle size={11} />
										HTTP {r.unauthStatus} ({copy.exposed})
									</span>
								)}
							</td>
							<td>
								{r.wafIntercepted ? (
									<span className={ins.badgePass}>
										<Flame size={11} />
										{copy.wafBlocked}
									</span>
								) : (
									<span className={s.statTag}>HTTP {r.wafStatus || '—'}</span>
								)}
							</td>
							<td>
								<span style={{ fontSize: 11, fontFamily: 'monospace' }}>
									{r.headers.csp ? 'CSP ' : ''}
									{r.headers.xFrameOptions ? 'X-Frame ' : ''}
									{r.headers.xContentTypeOptions ? 'X-Content' : ''}
									{!r.hasSecurityHeaders && '—'}
								</span>
							</td>
							<td>
								<span
									className={
										r.status === 'PASS' ? ins.badgePass : r.status === 'WARN' ? ins.badgeWarn : s.badgeFail
									}
								>
									{r.status}
								</span>
							</td>
							<td style={{ fontSize: 11.5, opacity: 0.7 }}>{r.latencyMs} ms</td>
							<td style={{ textAlign: 'right' }}>
								<button
									type="button"
									className={s.actionBtn}
									style={{ padding: '3px 8px', fontSize: 11, minHeight: 24, gap: 4 }}
									disabled={probingEndpoint === r.endpoint}
									onClick={() => void onProbeRoute(r.endpoint)}
									title={copy.probeRouteTitle}
								>
									<Activity size={11} className={probingEndpoint === r.endpoint ? s.spin : ''} />
									<span>{probingEndpoint === r.endpoint ? copy.probing : copy.probe}</span>
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
