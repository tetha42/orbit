'use client';

import React from 'react';
import { Flame, CheckCircle2, Ban } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Language } from '@/lib/i18n';
import socContract from '../../../soc.contract.json';
import { formatDateTime, type SecurityBlock } from '../../../types';
import { formatSocAlertMessage } from '../../../utils/i18nAlertLocalization';
import type { FirewallCopy } from './i18nFirewall';
import s from '../../../Soc.module.css';

interface ActiveBansTableProps {
	bans: SecurityBlock[];
	filteredBans: SecurityBlock[];
	activeBansOnlyCount: number;
	fwFilter: 'all' | 'ban' | 'whitelist';
	setFwFilter: (f: 'all' | 'ban' | 'whitelist') => void;
	hasSearchQuery: boolean;
	canManage: boolean;
	isSubmitting: boolean;
	language: Language;
	copy: FirewallCopy;
	onSelectDataDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	handleUnban: (ip: string) => Promise<void>;
}

export function ActiveBansTable({
	bans,
	filteredBans,
	activeBansOnlyCount,
	fwFilter,
	setFwFilter,
	hasSearchQuery,
	canManage,
	isSubmitting,
	language,
	copy,
	onSelectDataDoubleClick,
	onContainerDoubleClick,
	handleUnban,
}: ActiveBansTableProps) {
	const { t } = useI18n();
	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<Flame size={16} />
						{copy.bansTitle}
						<span
							className={`${s.badge} ${s.badgeNeutral}`}
							style={{ marginLeft: 8, fontSize: 10 }}
							title={copy.bansCapacityTitle}
						>
							{activeBansOnlyCount} / {socContract.limits.maxBans}
						</span>
					</h2>
					<p className={s.cardSub}>{copy.bansSub}</p>
				</div>

				<div className={s.formRow}>
					<button
						type="button"
						className={`${s.actionBtn} ${fwFilter === 'all' ? s.actionBtnPrimary : ''}`}
						onClick={() => setFwFilter('all')}
					>
						{copy.filterAll} ({bans.length})
					</button>
					<button
						type="button"
						className={`${s.actionBtn} ${fwFilter === 'ban' ? s.actionBtnDanger : ''}`}
						onClick={() => setFwFilter('ban')}
					>
						{copy.filterQuarantined} ({activeBansOnlyCount})
					</button>
					<button
						type="button"
						className={`${s.actionBtn} ${fwFilter === 'whitelist' ? s.actionBtnPrimary : ''}`}
						onClick={() => setFwFilter('whitelist')}
					>
						{t('socFwWhitelistBadge')} ({bans.length - activeBansOnlyCount})
					</button>
				</div>
			</div>

			{filteredBans.length === 0 ? (
				<div className={s.emptyState}>
					{hasSearchQuery ? copy.bansEmptySearch : copy.bansEmptyDefault}
				</div>
			) : (
				<div className={s.tableWrap} onDoubleClick={onContainerDoubleClick}>
					<table className={s.table}>
						<thead>
							<tr>
								<th>{t('socFwColIpSubnet')}</th>
								<th>{copy.colStatus}</th>
								<th>{copy.colScore}</th>
								<th>{copy.colReason}</th>
								<th>{copy.colExpires}</th>
								{canManage && <th>{copy.colAction}</th>}
							</tr>
						</thead>
						<tbody>
							{filteredBans.map((ban) => {
								const isBanned = ban.status === 'ban';
								return (
									<tr key={ban.ip}>
										<td className={s.mono}>
											<span
												data-type="ip"
												className={s.selectableData}
												onDoubleClick={onSelectDataDoubleClick}
												title={copy.dblClickIp}
											>
												{ban.ip}
											</span>
										</td>
										<td>
											<span className={`${s.badge} ${isBanned ? s.badgeDanger : s.badgeSuccess}`}>
												{isBanned ? copy.statusQuarantined : t('socFwWhitelistBadge')}
											</span>
										</td>
										<td className={s.mono}>
											{ban.threatScore > 0 ? (
												<span
													className={`${s.badge} ${
														ban.threatScore >= 80
															? s.badgeDanger
															: ban.threatScore >= 40
															? s.badgeWarn
															: s.badgeInfo
													}`}
												>
													{ban.threatScore} {t('socFwScoreUnit')}
												</span>
											) : (
												'-'
											)}
										</td>
										<td>
											<div>
												<span>{formatSocAlertMessage(ban.reason, language)}</span>
												{ban.threatIntel && (
													<div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: 2 }}>
														{(ban.threatIntel.isTorExit ||
															ban.threatIntel.isTorExitNode ||
															ban.threatIntel.isTor) && (
															<span className={`${s.badge} ${s.badgeDanger}`} style={{ marginRight: 4 }}>
																TOR
															</span>
														)}
														{ban.threatIntel.isDatacenter && (
															<span className={`${s.badge} ${s.badgeWarn}`} style={{ marginRight: 4 }}>
																{t('socFwDcCloud')}
															</span>
														)}
														{(ban.threatIntel.autonomousSystemOrg || ban.threatIntel.provider) && (
															<span>AS: {ban.threatIntel.autonomousSystemOrg || ban.threatIntel.provider}</span>
														)}
													</div>
												)}
											</div>
										</td>
										<td style={{ fontSize: '11px' }}>
											{ban.expiresAt ? formatDateTime(ban.expiresAt, language) : copy.permanent}
										</td>
										{canManage && (
											<td>
												<button
													type="button"
													className={`${s.actionBtn} ${isBanned ? s.actionBtnSuccess : s.actionBtnDanger}`}
													onClick={() => void handleUnban(ban.ip)}
													disabled={isSubmitting}
													style={{ padding: '6px 12px' }}
												>
													{isBanned ? <CheckCircle2 size={12} /> : <Ban size={12} />}
													{isBanned ? copy.unbanBtn : copy.removeBtn}
												</button>
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
