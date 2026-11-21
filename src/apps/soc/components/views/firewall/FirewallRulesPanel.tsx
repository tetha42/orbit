'use client';

import React from 'react';
import { ShieldAlert, Play, Plus, RefreshCw } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import type { SecurityRule } from '@/lib/securityRules';
import type { FirewallCopy } from './i18nFirewall';
import type { useFirewallRules } from './useFirewallRules';
import { RuleSimulatorBench } from './RuleSimulatorBench';
import { SecurityRulesTable } from './SecurityRulesTable';
import { RuleCreatorModal } from './RuleCreatorModal';
import s from '../../../Soc.module.css';

interface FirewallRulesPanelProps {
	rulesApi: ReturnType<typeof useFirewallRules>;
	filteredRules: SecurityRule[];
	hasSearchQuery: boolean;
	canManage: boolean;
	language: Language;
	copy: FirewallCopy;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
}

export function FirewallRulesPanel({
	rulesApi,
	filteredRules,
	hasSearchQuery,
	canManage,
	language,
	copy,
	onContainerDoubleClick,
}: FirewallRulesPanelProps) {
	return (
		<>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
				<div>
					<h2 className={s.cardTitle}>
						<ShieldAlert size={16} />
						{copy.rulesEngineTitle}
					</h2>
					<p className={s.cardSub}>{copy.rulesEngineSub}</p>
				</div>

				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<button
						type="button"
						className={`${s.actionBtn} ${rulesApi.showSimulator ? s.actionBtnPrimary : ''}`}
						onClick={() => rulesApi.setShowSimulator((prev) => !prev)}
						style={{ padding: '7px 12px' }}
					>
						<Play size={13} />
						<span>{copy.simulatorBenchBtn}</span>
					</button>

					{canManage && (
						<button
							type="button"
							className={`${s.actionBtn} ${s.actionBtnPrimary}`}
							onClick={() => rulesApi.setShowCreatorModal(true)}
							style={{ padding: '7px 14px' }}
						>
							<Plus size={14} />
							<span>{copy.createRuleBtn}</span>
						</button>
					)}

					<button
						type="button"
						className={s.actionBtn}
						onClick={() => void rulesApi.fetchRules()}
						disabled={rulesApi.isLoadingRules}
						style={{ padding: '7px 10px' }}
						title={copy.refreshRulesTitle}
					>
						<RefreshCw size={13} className={rulesApi.isLoadingRules ? s.spin : ''} />
					</button>
				</div>
			</div>

			{rulesApi.showSimulator && (
				<RuleSimulatorBench
					simMethod={rulesApi.simMethod}
					setSimMethod={rulesApi.setSimMethod}
					simPath={rulesApi.simPath}
					setSimPath={rulesApi.setSimPath}
					simIp={rulesApi.simIp}
					setSimIp={rulesApi.setSimIp}
					simHeaders={rulesApi.simHeaders}
					setSimHeaders={rulesApi.setSimHeaders}
					simBody={rulesApi.simBody}
					setSimBody={rulesApi.setSimBody}
					isSimulating={rulesApi.isSimulating}
					simResult={rulesApi.simResult}
					copy={copy}
					onRun={rulesApi.handleRunSimulation}
					onClose={() => rulesApi.setShowSimulator(false)}
				/>
			)}

			<SecurityRulesTable
				rules={filteredRules}
				hasSearchQuery={hasSearchQuery}
				canManage={canManage}
				language={language}
				copy={copy}
				onContainerDoubleClick={onContainerDoubleClick}
				onToggleRule={rulesApi.handleToggleRule}
				onDeleteRule={rulesApi.handleDeleteRule}
			/>

			{rulesApi.showCreatorModal && (
				<RuleCreatorModal
					ruleName={rulesApi.ruleName}
					setRuleName={rulesApi.setRuleName}
					ruleDesc={rulesApi.ruleDesc}
					setRuleDesc={rulesApi.setRuleDesc}
					rulePriority={rulesApi.rulePriority}
					setRulePriority={rulesApi.setRulePriority}
					ruleMatchMode={rulesApi.ruleMatchMode}
					setRuleMatchMode={rulesApi.setRuleMatchMode}
					ruleAction={rulesApi.ruleAction}
					setRuleAction={rulesApi.setRuleAction}
					rateLimitCount={rulesApi.rateLimitCount}
					setRateLimitCount={rulesApi.setRateLimitCount}
					rateLimitWindow={rulesApi.rateLimitWindow}
					setRateLimitWindow={rulesApi.setRateLimitWindow}
					scorePoints={rulesApi.scorePoints}
					setScorePoints={rulesApi.setScorePoints}
					ruleConditions={rulesApi.ruleConditions}
					isSavingRule={rulesApi.isSavingRule}
					copy={copy}
					onAddCondition={rulesApi.handleAddCondition}
					onRemoveCondition={rulesApi.handleRemoveCondition}
					onUpdateCondition={rulesApi.handleUpdateCondition}
					onSave={rulesApi.handleSaveRule}
					onClose={() => rulesApi.setShowCreatorModal(false)}
				/>
			)}
		</>
	);
}
