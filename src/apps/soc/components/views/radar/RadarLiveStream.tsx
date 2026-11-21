'use client';

import React from 'react';
import { Radio, FileSearch } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime, type InspectorEntity, type SocTab, type SystemLog } from '../../../types';
import type { RadarStreamCopy } from './i18nRadarStream';
import s from '../../../Soc.module.css';

interface RadarLiveStreamProps {
	events: SystemLog[];
	hasSearchQuery: boolean;
	language: Language;
	copy: RadarStreamCopy;
	onOpenSiem: (tab: SocTab) => void;
	onSelectDataDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	openInspector: (entity: InspectorEntity) => void;
}

export function RadarLiveStream({
	events,
	hasSearchQuery,
	language,
	copy,
	onOpenSiem,
	onSelectDataDoubleClick,
	onContainerDoubleClick,
	openInspector,
}: RadarLiveStreamProps) {
	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<Radio size={16} />
						{copy.streamTitle}
					</h2>
					<p className={s.cardSub}>{copy.streamSub}</p>
				</div>
				<button type="button" className={s.actionBtn} onClick={() => onOpenSiem('siem')}>
					<FileSearch size={12} />
					{copy.openFullSiem}
				</button>
			</div>

			{events.length === 0 ? (
				<div className={s.emptyState}>
					{hasSearchQuery ? copy.streamEmptySearch : copy.streamEmptyDefault}
				</div>
			) : (
				<div className={s.tableWrap} onDoubleClick={onContainerDoubleClick}>
					<table className={s.table}>
						<thead>
							<tr>
								<th>{copy.colTime}</th>
								<th>{copy.colLevel}</th>
								<th>{copy.colService}</th>
								<th>{copy.colMessage}</th>
								<th>IP</th>
							</tr>
						</thead>
						<tbody>
							{events.slice(0, 8).map((ev) => {
								const sevBadge =
									ev.level === 'CRITICAL' || ev.level === 'ERROR'
										? s.badgeDanger
										: ev.level === 'WARN'
										? s.badgeWarn
										: s.badgeInfo;

								return (
									<tr key={ev.id} style={{ cursor: 'pointer' }} onClick={() => openInspector({ type: 'event', data: ev })}>
										<td className={s.mono}>
											<span
												data-type="timestamp"
												className={s.selectableData}
												onDoubleClick={onSelectDataDoubleClick}
												title={copy.dblClickTimestamp}
											>
												{formatDateTime(ev.time, language)}
											</span>
										</td>
										<td>
											<span
												data-type="level"
												className={`${s.badge} ${sevBadge} ${s.selectableData}`}
												onDoubleClick={onSelectDataDoubleClick}
												title={copy.dblClickLevel}
											>
												{ev.level}
											</span>
										</td>
										<td>
											<span
												data-type="service"
												data-value={ev.service}
												className={`${s.badge} ${s.badgeNeutral} ${s.selectableData}`}
												onDoubleClick={onSelectDataDoubleClick}
												title={copy.dblClickService}
											>
												{ev.service}
											</span>
										</td>
										<td>
											<span
												data-type="message"
												className={s.selectableData}
												onDoubleClick={onSelectDataDoubleClick}
												title={copy.dblClickMessage}
											>
												{ev.message}
											</span>
										</td>
										<td className={s.mono}>
											<span
												data-type="ip"
												data-value={ev.ip}
												className={s.selectableData}
												onDoubleClick={onSelectDataDoubleClick}
												title={copy.dblClickIp}
											>
												{ev.ip || '—'}
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
