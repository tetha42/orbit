'use client';

import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime, type ActiveRateLimit } from '../../../types';
import type { RadarStreamCopy } from './i18nRadarStream';
import s from '../../../Soc.module.css';

interface RadarRateLimitsProps {
	rateLimits: ActiveRateLimit[];
	canManage: boolean;
	isSubmitting: boolean;
	language: Language;
	copy: RadarStreamCopy;
	onSelectDataDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	handleClearRateLimit: (key: string) => Promise<void>;
}

export function RadarRateLimits({
	rateLimits,
	canManage,
	isSubmitting,
	language,
	copy,
	onSelectDataDoubleClick,
	onContainerDoubleClick,
	handleClearRateLimit,
}: RadarRateLimitsProps) {
	if (rateLimits.length === 0) return null;

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
				<span className={`${s.badge} ${s.badgeWarn}`}>
					{rateLimits.length} {copy.activeSuffix}
				</span>
			</div>

			<div className={s.tableWrap} onDoubleClick={onContainerDoubleClick}>
				<table className={s.table}>
					<thead>
						<tr>
							<th>{copy.colKey}</th>
							<th>{copy.colHits}</th>
							<th>{copy.colRetryAfter}</th>
							<th>{copy.colResetAt}</th>
							{canManage && <th>{copy.colOp}</th>}
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
									<span className={`${s.badge} ${rl.count >= 5 ? s.badgeDanger : s.badgeWarn}`}>{rl.count}x</span>
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
											style={{ padding: '4px 10px', fontSize: 11 }}
										>
											<RefreshCw size={11} />
											{copy.resetLimitBtn}
										</button>
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
