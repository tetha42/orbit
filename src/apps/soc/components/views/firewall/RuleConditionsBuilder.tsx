'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ConditionType, SecurityRuleCondition } from '@/lib/securityRules';
import type { FirewallCopy } from './i18nFirewall';
import s from '../../../Soc.module.css';

interface RuleConditionsBuilderProps {
	conditions: SecurityRuleCondition[];
	copy: FirewallCopy;
	onAdd: () => void;
	onRemove: (idx: number) => void;
	onUpdate: (idx: number, patch: Partial<SecurityRuleCondition>) => void;
}

export function RuleConditionsBuilder({
	conditions,
	copy,
	onAdd,
	onRemove,
	onUpdate,
}: RuleConditionsBuilderProps) {
	const { t } = useI18n();
	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
				<label style={{ fontSize: 12, fontWeight: 700 }}>
					{copy.conditionsLabel} ({conditions.length})
				</label>
				<button type="button" className={s.actionBtn} onClick={onAdd} style={{ padding: '3px 8px', fontSize: 11 }}>
					<Plus size={12} />
					<span>{copy.addConditionBtn}</span>
				</button>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				{conditions.map((cond, idx) => (
					<div
						key={idx}
						style={{
							display: 'flex',
							gap: 6,
							alignItems: 'center',
							background: 'var(--card-bg, rgba(0,0,0,0.03))',
							padding: 6,
							borderRadius: 8,
						}}
					>
						<select
							className={s.select}
							value={cond.type}
							onChange={(e) => onUpdate(idx, { type: e.target.value as ConditionType })}
							style={{ fontSize: 11, width: 110 }}
						>
							<option value="path_pattern">{t('socRuleCondPathGlob')}</option>
							<option value="ip_cidr">{t('socRuleCondIpCidr')}</option>
							<option value="method">{t('socRuleCondMethod')}</option>
							<option value="header">{t('socRuleCondHeader')}</option>
							<option value="payload_regex">{t('socRuleCondRegex')}</option>
						</select>

						{cond.type === 'header' && (
							<input
								type="text"
								className={s.input}
								value={cond.field || ''}
								onChange={(e) => onUpdate(idx, { field: e.target.value })}
								placeholder={t('socRuleHeaderNamePh')}
								style={{ fontSize: 11, width: 100 }}
							/>
						)}

						{cond.type === 'method' ? (
							<select
								className={s.select}
								value={cond.value}
								onChange={(e) => onUpdate(idx, { value: e.target.value })}
								style={{ fontSize: 11, flex: 1 }}
							>
								<option value="GET">GET</option>
								<option value="POST">POST</option>
								<option value="PUT">PUT</option>
								<option value="DELETE">DELETE</option>
								<option value="PATCH">PATCH</option>
							</select>
						) : (
							<input
								type="text"
								className={`${s.input} ${s.mono}`}
								value={cond.value}
								onChange={(e) => onUpdate(idx, { value: e.target.value })}
								placeholder={
									cond.type === 'ip_cidr'
										? '198.51.100.0/24'
										: cond.type === 'path_pattern'
										? '/api/admin/**'
										: cond.type === 'header'
										? t('socRuleHeaderValPh')
										: t('socRuleRegexPh')
								}
								style={{ fontSize: 11, flex: 1 }}
								required
							/>
						)}

						<button
							type="button"
							className={`${s.actionBtn} ${s.actionBtnDanger}`}
							onClick={() => onRemove(idx)}
							aria-label={t('delete')}
							style={{ padding: '4px 6px' }}
						>
							<Trash2 size={12} />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
