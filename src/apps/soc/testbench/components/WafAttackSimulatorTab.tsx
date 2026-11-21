'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import s from './Testbench.module.css';
import { WAF_SIM_I18N } from './i18nWafSimulator';
import { ATTACK_SCENARIOS, runAttackScenario, type AttackScenario } from './wafScenarios';
import { WafMetricsAndControls } from './WafMetricsAndControls';
import { WafScenarioRow } from './WafScenarioRow';

export function WafAttackSimulatorTab() {
	const { language } = useI18n();
	const copy = WAF_SIM_I18N[language] ?? WAF_SIM_I18N.en;

	const [scenarios, setScenarios] = useState<AttackScenario[]>(ATTACK_SCENARIOS);
	const [isRunning, setIsRunning] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const handleRunAllAttacks = async () => {
		setIsRunning(true);
		const updated: AttackScenario[] = [];

		for (const scenario of scenarios) {
			const res = await runAttackScenario(scenario);
			updated.push(res);
			setScenarios([...updated, ...scenarios.slice(updated.length)]);
		}

		setIsRunning(false);
	};

	const totalTested = scenarios.filter((item) => item.status !== undefined).length;
	const totalBlocked = scenarios.filter((item) => item.blocked).length;
	const blockRate = totalTested > 0 ? Math.round((totalBlocked / totalTested) * 100) : 100;
	const avgLatency =
		totalTested > 0
			? Math.round(
					scenarios
						.filter((item) => item.latencyMs !== undefined)
						.reduce((acc, item) => acc + (item.latencyMs || 0), 0) / totalTested
				)
			: 0;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<WafMetricsAndControls
				copy={copy}
				scenarioCount={scenarios.length}
				totalTested={totalTested}
				totalBlocked={totalBlocked}
				blockRate={blockRate}
				avgLatency={avgLatency}
				isRunning={isRunning}
				onRunAll={handleRunAllAttacks}
			/>

			<div className={s.tableContainer}>
				<table className={s.table}>
					<thead>
						<tr>
							<th>{copy.colScenario}</th>
							<th>{copy.colCategory}</th>
							<th>{copy.colEndpoint}</th>
							<th>{copy.colStatus}</th>
							<th>{copy.colProtection}</th>
							<th>{copy.colLatency}</th>
							<th>{copy.colInspect}</th>
						</tr>
					</thead>
					<tbody>
						{scenarios.map((sc) => (
							<WafScenarioRow
								key={sc.id}
								scenario={sc}
								isExpanded={expandedId === sc.id}
								copy={copy}
								onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
							/>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default WafAttackSimulatorTab;
