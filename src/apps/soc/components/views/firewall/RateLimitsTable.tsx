'use client';

import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime, type ActiveRateLimit } from '../../../types';
import type { FirewallCopy } from './i18nFirewall';
import s from '../../../Soc.module.css';

interface RateLimitsTableProps {
	rateLimits: ActiveRateLimit[];
	hasSearchQuery: boolean;
	canManage: boolean;
	isSubmitting: boolean;
	language: Language;
	copy: FirewallCopy;
	onSelectDataDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	handleClearRateLimit: (key: string) => Promise<void>;
}

export function RateLimitsTable({
	rateLimits,
	hasSearchQuery,
	canManage,
	isSubmitting,
	language,
	copy,
	onSelectDataDoubleClick,
	onContainerDoubleClick,
	handleClearRateLimit,
}: RateLimitsTableProps) {
	return (
		<section className={s.card}>
			<div className={s.cardHeader}>
				<div>
					<h2 className={s.cardTitle}>
						<Activity size={16} />
						{copy.rateLimitsTitle}
					</h2>
					<p className={s.cardSub}>{copy.rateLimitsSub}</p>
				</div>
			</div>

			{rateLimits.length === 0 ? (
				<div className={s.emptyState}>
					{hasSearchQuery ? copy.rateLimitsEmptySearch : copy.rateLimitsEmptyDefault}
				</div>
			) : (
				<div className={s.tableWrap} onDoubleClick={onContainerDoubleClick}>
					<table className={s.table}>
						<thead>
							<tr>
								<th>{copy.colKey}</th>
								<th>{copy.colHits}</th>
								<th>{copy.colRetryAfter}</th>
								<th>{copy.colResetAt}</th>
								{canManage && <th>{copy.colAction}</th>}
							</tr>
						</thead>
						<tbody>
							{rateLimits.map((rl) => (
								<tr key={rl.key}>
									<td className={s.mono}>
										<span
											data-type="key"
											className={s.selectableData}
											onDoubleClick={onSelectDataDoubleClick}
											title={copy.dblClickKey}
										>
											{rl.key}
										</span>
									</td>
									<td className={s.mono}>
										<span className={`${s.badge} ${rl.count >= 5 ? s.badgeDanger : s.badgeWarn}`}>
											{rl.count}x
										</span>
									</td>
									<td className={s.mono}>{rl.retryAfter}s</td>
									<td>{formatDateTime(rl.resetAt, language)}</td>
									{canManage && (
										<td>
											<button
												type="button"
												className={`${s.actionBtn} ${s.actionBtnPrimary}`}
												onClick={() => void handleClearRateLimit(rl.key)}
												disabled={isSubmitting}
												style={{ padding: '6px 12px' }}
											>
												<RefreshCw size={12} />
												{copy.resetLimitBtn}
											</button>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
