'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatDateTime, type InspectorEntity, type SocIncident } from '../../../types';
import type { Language } from '@/lib/i18n';
import type { RadarMainCopy } from './i18nRadarMain';
import s from '../../../Soc.module.css';

interface RadarIncidentBoardProps {
	incidents: SocIncident[];
	language: Language;
	copy: RadarMainCopy;
	onSelectDataDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	openInspector: (entity: InspectorEntity) => void;
}

export function RadarIncidentBoard({
	incidents,
	language,
	copy,
	onSelectDataDoubleClick,
	onContainerDoubleClick,
	openInspector,
}: RadarIncidentBoardProps) {
	const activeCount = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'false_positive').length;

	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<ShieldAlert size={16} />
						{copy.incidentsTitle}
					</h2>
					<p className={s.cardSub}>{copy.incidentsSub}</p>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<span className={`${s.badge} ${activeCount > 0 ? s.badgeDanger : s.badgeSuccess}`}>
						{activeCount} {copy.incidentsActiveSuffix}
					</span>
				</div>
			</div>

			{incidents.length > 0 ? (
				<div className={s.tableContainer} onDoubleClick={onContainerDoubleClick}>
					<table className={s.table}>
						<thead>
							<tr>
								<th>{copy.colStatus}</th>
								<th>{copy.colSeverity}</th>
								<th>{copy.colIncidentTitle}</th>
								<th>{copy.colSourceIp}</th>
								<th>{copy.colService}</th>
								<th>{copy.colCreatedAt}</th>
								<th>{copy.colActions}</th>
							</tr>
						</thead>
						<tbody>
							{incidents.slice(0, 10).map((inc) => (
								<tr key={inc.id}>
									<td>
										<span
											className={
												inc.status === 'new'
													? s.badgeFail
													: inc.status === 'investigating' || inc.status === 'triaged'
													? s.badgeWarn
													: inc.status === 'contained'
													? s.badgePrimary
													: s.statTag
											}
										>
											{inc.status.toUpperCase()}
										</span>
									</td>
									<td>
										<span
											style={{
												fontSize: 10.5,
												fontWeight: 700,
												padding: '2px 6px',
												borderRadius: 4,
												background:
													inc.severity === 'CRITICAL'
														? 'color-mix(in srgb, var(--danger) 15%, transparent)'
														: inc.severity === 'HIGH'
														? 'color-mix(in srgb, var(--warning) 15%, transparent)'
														: 'color-mix(in srgb, var(--accent) 15%, transparent)',
												color:
													inc.severity === 'CRITICAL'
														? 'var(--danger)'
														: inc.severity === 'HIGH'
														? '#b25000'
														: '#0071e3',
											}}
										>
											{inc.severity}
										</span>
									</td>
									<td style={{ fontWeight: 600, fontSize: 12 }}>{inc.title}</td>
									<td className={s.mono} style={{ fontSize: 11 }}>
										{inc.sourceIp ? (
											<span
												data-type="ip"
												className={s.selectableData}
												onDoubleClick={onSelectDataDoubleClick}
											>
												{inc.sourceIp}
											</span>
										) : (
											'—'
										)}
									</td>
									<td style={{ fontSize: 11 }}>{inc.service || 'security'}</td>
									<td style={{ fontSize: 11, opacity: 0.75 }}>{formatDateTime(inc.createdAt, language)}</td>
									<td>
										<button
											type="button"
											className={s.actionBtn}
											style={{ height: 24, padding: '0 8px', fontSize: 11 }}
											onClick={() => openInspector({ type: 'incident', data: inc })}
										>
											<span>{copy.inspectAndTriage}</span>
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className={s.cleanState}>
					<ShieldCheck size={20} />
					<div>
						<strong>{copy.noIncidentsTitle}</strong>
						<div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{copy.noIncidentsDesc}</div>
					</div>
				</div>
			)}
		</section>
	);
}
