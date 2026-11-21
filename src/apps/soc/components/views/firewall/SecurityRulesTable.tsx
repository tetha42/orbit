'use client';

import React from 'react';
import { ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import type { SecurityRule } from '@/lib/securityRules';
import { formatDateTime } from '../../../types';
import type { FirewallCopy } from './i18nFirewall';
import s from '../../../Soc.module.css';

interface SecurityRulesTableProps {
	rules: SecurityRule[];
	hasSearchQuery: boolean;
	canManage: boolean;
	language: Language;
	copy: FirewallCopy;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onToggleRule: (rule: SecurityRule) => Promise<void>;
	onDeleteRule: (id: string) => Promise<void>;
}

export function SecurityRulesTable({
	rules,
	hasSearchQuery,
	canManage,
	language,
	copy,
	onContainerDoubleClick,
	onToggleRule,
	onDeleteRule,
}: SecurityRulesTableProps) {
	return (
		<section className={s.card}>
			{rules.length === 0 ? (
				<div className={s.emptyState}>{hasSearchQuery ? copy.rulesEmptySearch : copy.rulesEmptyDefault}</div>
			) : (
				<div className={s.tableWrap} onDoubleClick={onContainerDoubleClick}>
					<table className={s.table}>
						<thead>
							<tr>
								<th>{copy.colPriority}</th>
								<th>{copy.colRuleNameDesc}</th>
								<th>{copy.colConditions}</th>
								<th>{copy.colRuleAction}</th>
								<th>{copy.colRuleHits}</th>
								<th>{copy.colStatus}</th>
								{canManage && <th>{copy.colManage}</th>}
							</tr>
						</thead>
						<tbody>
							{rules.map((rule) => {
								const actionColorClass =
									rule.action === 'block'
										? s.badgeDanger
										: rule.action === 'allow'
										? s.badgeSuccess
										: rule.action === 'rate_limit'
										? s.badgeWarn
										: s.badgeInfo;

								return (
									<tr key={rule.id} style={{ opacity: rule.enabled ? 1 : 0.6 }}>
										<td className={s.mono} style={{ fontWeight: 600 }}>
											#{rule.priority}
										</td>
										<td>
											<div>
												<span style={{ fontWeight: 600 }}>{rule.name}</span>
												{rule.description && (
													<div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
														{rule.description}
													</div>
												)}
											</div>
										</td>
										<td>
											<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
												<span className={`${s.badge} ${s.badgeNeutral}`} style={{ fontSize: 10, padding: '1px 4px' }}>
													{rule.matchMode.toUpperCase()}
												</span>
												{rule.conditions.map((c, idx) => (
													<span
														key={idx}
														className={`${s.badge} ${s.badgeNeutral} ${s.mono}`}
														style={{ fontSize: 10, padding: '1px 5px' }}
													>
														{c.type === 'ip_cidr' && `IP: ${c.value}`}
														{c.type === 'path_pattern' && `Path: ${c.value}`}
														{c.type === 'method' && `Method: ${c.value}`}
														{c.type === 'header' && `${c.field || 'Header'}: ${c.value}`}
														{c.type === 'payload_regex' && `Regex: ${c.value}`}
													</span>
												))}
											</div>
										</td>
										<td>
											<span className={`${s.badge} ${actionColorClass}`}>{rule.action.toUpperCase()}</span>
										</td>
										<td className={s.mono}>
											<span>{rule.hitsCount ?? 0}</span>
											{rule.lastHitAt && (
												<div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
													{formatDateTime(rule.lastHitAt, language)}
												</div>
											)}
										</td>
										<td>
											<button
												type="button"
												onClick={() => void onToggleRule(rule)}
												style={{
													background: 'transparent',
													border: 'none',
													cursor: 'pointer',
													display: 'inline-flex',
													alignItems: 'center',
													gap: 4,
													color: rule.enabled ? 'var(--success)' : 'var(--text-secondary)',
												}}
											>
												{rule.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
												<span style={{ fontSize: 11 }}>{rule.enabled ? copy.ruleActive : copy.ruleDisabled}</span>
											</button>
										</td>
										{canManage && (
											<td>
												<button
													type="button"
													className={`${s.actionBtn} ${s.actionBtnDanger}`}
													onClick={() => void onDeleteRule(rule.id)}
													style={{ padding: '4px 8px' }}
													title={copy.deleteRuleTitle}
												>
													<Trash2 size={13} />
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
