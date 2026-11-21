'use client';

import React from 'react';
import { Flame, EyeOff, Globe, AlertTriangle, Ban } from 'lucide-react';
import { fill } from '@/lib/text';
import type { Language } from '@/lib/i18n';
import { formatSocAlertMessage } from '../../../utils/i18nAlertLocalization';
import type { InspectorEntity, TopAttackerItem } from '../../../types';
import type { RadarStreamCopy } from './i18nRadarStream';
import s from '../../../Soc.module.css';
import r from '../../../SocRadar.module.css';

interface RadarTopAttackersProps {
	attackers: TopAttackerItem[];
	hasSearchQuery: boolean;
	callerIp: string | null;
	canManage: boolean;
	isSubmitting: boolean;
	language: Language;
	copy: RadarStreamCopy;
	onSelectDataDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	openInspector: (entity: InspectorEntity) => void;
	handleUnban: (ip: string) => Promise<void>;
	handleQuickBan: (ip: string, reason: string) => Promise<void>;
}

export function RadarTopAttackers({
	attackers,
	hasSearchQuery,
	callerIp,
	canManage,
	isSubmitting,
	language,
	copy,
	onSelectDataDoubleClick,
	onContainerDoubleClick,
	openInspector,
	handleUnban,
	handleQuickBan,
}: RadarTopAttackersProps) {
	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<Flame size={16} />
						{copy.attackersTitle}
					</h2>
					<p className={s.cardSub}>{copy.attackersSub}</p>
				</div>
			</div>

			{attackers.length === 0 ? (
				<div className={s.emptyState}>
					{hasSearchQuery ? copy.attackersEmptySearch : copy.attackersEmptyDefault}
				</div>
			) : (
				<div className={s.tableWrap} onDoubleClick={onContainerDoubleClick}>
					<table className={s.table}>
						<thead>
							<tr>
								<th>IP</th>
								<th>{copy.colScore}</th>
								<th>{copy.colStatus}</th>
								<th>{copy.colLastAlert}</th>
								{canManage && <th>{copy.colAction}</th>}
							</tr>
						</thead>
						<tbody>
							{attackers.map((att) => {
								const pct = Math.min(100, Math.max(5, att.threatScore));
								const barColor =
									pct >= 80 ? 'var(--danger)' : pct >= 50 ? 'var(--warning)' : 'var(--accent)';
								const localizedMsg = formatSocAlertMessage(att.lastMessage, language);

								return (
									<tr
										key={att.ip}
										style={{ cursor: 'pointer' }}
										onClick={() =>
											openInspector({
												type: 'ip',
												data: { ip: att.ip, attackerInfo: att, threatIntel: att.threatIntel },
											})
										}
									>
										<td className={s.mono}>
											<div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
												<span
													data-type="ip"
													data-value={att.ip}
													className={s.selectableData}
													onDoubleClick={onSelectDataDoubleClick}
													title={copy.dblClickIp}
												>
													{att.ip}
												</span>
												{(att.threatIntel?.isTorExitNode || att.threatIntel?.isTor) && (
													<span className={`${r.threatBadge} ${r.threatBadgeTor}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
														<EyeOff size={11} /> Tor
													</span>
												)}
												{(att.threatIntel?.isCloudHosting || att.threatIntel?.isDatacenter) && (
													<span className={`${r.threatBadge} ${r.threatBadgeCloud}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
														<Globe size={11} /> {att.threatIntel.provider || 'Cloud'}
													</span>
												)}
												{att.threatIntel?.riskLevel === 'HIGH' && (
													<span className={`${r.threatBadge} ${r.threatBadgeHigh}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
														<AlertTriangle size={11} /> {copy.riskHigh}
													</span>
												)}
											</div>
										</td>
										<td>
											<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
												<div className={r.scoreBarWrap}>
													<div className={r.scoreBarFill} style={{ width: `${pct}%`, background: barColor }} />
												</div>
												<span className={s.mono}>
													{att.threatScore} ({att.eventCount})
												</span>
											</div>
										</td>
										<td>
											{att.status === 'ban' ? (
												<span className={`${s.badge} ${s.badgeDanger}`}>{copy.statusBanned}</span>
											) : att.status === 'whitelist' ? (
												<span className={`${s.badge} ${s.badgeSuccess}`}>{copy.statusWhitelist}</span>
											) : (
												<span className={`${s.badge} ${s.badgeWarn}`}>{copy.statusMonitored}</span>
											)}
										</td>
										<td
											style={{ maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
											title={localizedMsg}
										>
											{localizedMsg}
										</td>
										{canManage && (
											<td onClick={(e) => e.stopPropagation()}>
												{att.status === 'ban' ? (
													<button
														type="button"
														className={s.actionBtn}
														onClick={() => void handleUnban(att.ip)}
														disabled={isSubmitting}
													>
														{copy.unbanBtn}
													</button>
												) : att.ip !== callerIp ? (
													<button
														type="button"
														className={`${s.actionBtn} ${s.actionBtnDanger}`}
														onClick={() =>
															void handleQuickBan(
																att.ip,
																fill(copy.manualQuarantineTemplate, { count: att.eventCount })
															)
														}
														disabled={isSubmitting}
													>
														<Ban size={12} />
														{copy.banBtn}
													</button>
												) : (
													<span className={`${s.badge} ${s.badgeInfo}`}>{copy.youBadge}</span>
												)}
											</td>
										)}
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
