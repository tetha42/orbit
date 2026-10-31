'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import { OAuthSimulatorTab } from '../../testbench/components/OAuthSimulatorTab';
import { ApiSuiteTab } from '../../testbench/components/ApiSuiteTab';
import { HealthDiagnosticsTab } from '../../testbench/components/HealthDiagnosticsTab';
import { SessionInspectorTab } from '../../testbench/components/SessionInspectorTab';
import { WafAttackSimulatorTab } from '../../testbench/components/WafAttackSimulatorTab';
import { LAB_SEGMENTS, SOC_LAB_TABS } from '../../types';
import type { TestbenchTab } from '../../types';
import s from '../../Soc.module.css';

export const TestbenchView = React.memo(function TestbenchView() {
	const { activeTab, openLabTab, tb, canManage, isEn } = useSoc();
	const { t } = useI18n();

	const labTab = (['oauth', 'api', 'fuzzer', 'health', 'session'].includes(activeTab)
		? activeTab
		: 'api') as TestbenchTab;

	return (
		<div className={s.viewContainer}>
			<div className={s.labSegmentBar}>
				<nav className={s.labSegment} aria-label={isEn ? 'Test lab tabs' : 'Test laboratuvarı sekmeleri'}>
					{LAB_SEGMENTS.filter((seg) => canManage || SOC_LAB_TABS.includes(seg.id)).map((seg) => (
						<button
							key={seg.id}
							type="button"
							className={`${s.labSegmentBtn} ${labTab === seg.id ? s.labSegmentBtnActive : ''}`}
							onClick={() => openLabTab(seg.id)}
						>
							{t(seg.key, isEn ? seg.en : seg.tr)}
						</button>
					))}
				</nav>
			</div>

			{labTab === 'oauth' && (
				<OAuthSimulatorTab
					clients={tb.clients}
					selectedClientId={tb.selectedClientId}
					onSelectClientId={tb.setSelectedClientId}
					selectedScopes={tb.selectedScopes}
					onToggleScope={tb.toggleScope}
					oauthLoading={tb.oauthLoading}
					oauthResult={tb.oauthResult}
					onRunSimulation={tb.runOAuthSimulation}
					tokenInput={tb.tokenInput}
					onTokenInputChange={tb.setTokenInput}
					inspectResult={tb.inspectResult}
					isInspecting={tb.isInspecting}
					onInspectToken={tb.inspectToken}
				/>
			)}
			{labTab === 'api' && (
				<ApiSuiteTab items={tb.apiItems} isRunning={tb.isRunningSuite} onRunSuite={tb.runApiSuite} />
			)}
			{labTab === 'fuzzer' && (
				<WafAttackSimulatorTab />
			)}
			{labTab === 'health' && (
				<HealthDiagnosticsTab health={tb.health} isLoading={tb.isHealthLoading} onRefresh={tb.refetchHealth} />
			)}
			{labTab === 'session' && (
				<SessionInspectorTab sessionInfo={tb.sessionInfo} isLoading={tb.isSessionLoading} />
			)}
		</div>
	);
});
