'use client';

import React, { useState, useMemo } from 'react';
import { Ban, ShieldAlert } from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { FIREWALL_I18N } from './firewall/i18nFirewall';
import { useFirewallRules } from './firewall/useFirewallRules';
import { QuarantineForm } from './firewall/QuarantineForm';
import { ActiveBansTable } from './firewall/ActiveBansTable';
import { RateLimitsTable } from './firewall/RateLimitsTable';
import { FirewallRulesPanel } from './firewall/FirewallRulesPanel';
import s from '../../Soc.module.css';

export const FirewallView = React.memo(function FirewallView() {
	const {
		bans,
		overview,
		callerIp,
		canManage,
		isSubmitting,
		fwIp,
		setFwIp,
		fwMode,
		setFwMode,
		fwDuration,
		setFwDuration,
		fwReason,
		setFwReason,
		fwFilter,
		setFwFilter,
		handleFirewallSubmit,
		handleUnban,
		handleClearRateLimit,
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
		language,
		globalSearch,
	} = useSoc();

	const copy = FIREWALL_I18N[language] ?? FIREWALL_I18N.en;
	const [activeSubTab, setActiveSubTab] = useState<'quarantine' | 'rules'>('quarantine');
	const rulesApi = useFirewallRules(activeSubTab);

	const query = globalSearch.trim().toLowerCase();
	const filteredBans = useMemo(() => {
		return bans.filter((b) => {
			if (fwFilter !== 'all' && b.status !== fwFilter) return false;
			if (!query) return true;
			return (
				b.ip.toLowerCase().includes(query) ||
				(b.reason && b.reason.toLowerCase().includes(query)) ||
				(b.status && b.status.toLowerCase().includes(query))
			);
		});
	}, [bans, fwFilter, query]);

	const activeBansOnlyCount = useMemo(() => bans.filter((b) => b.status === 'ban').length, [bans]);

	const filteredRateLimits = useMemo(() => {
		return (overview?.metrics.activeRateLimits ?? []).filter((rl) => {
			if (!query) return true;
			return rl.key.toLowerCase().includes(query);
		});
	}, [overview?.metrics.activeRateLimits, query]);

	const filteredRules = useMemo(() => {
		if (!query) return rulesApi.rules;
		return rulesApi.rules.filter(
			(r) =>
				r.name.toLowerCase().includes(query) ||
				(r.description && r.description.toLowerCase().includes(query)) ||
				r.action.toLowerCase().includes(query) ||
				r.conditions.some((c) => c.value.toLowerCase().includes(query))
		);
	}, [rulesApi.rules, query]);

	return (
		<div className={s.viewContainer}>
			<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
				<button
					type="button"
					className={`${s.actionBtn} ${activeSubTab === 'quarantine' ? s.actionBtnPrimary : ''}`}
					onClick={() => setActiveSubTab('quarantine')}
					style={{ padding: '8px 14px', fontSize: '12px' }}
				>
					<Ban size={14} />
					<span>{copy.tabQuarantine}</span>
				</button>
				<button
					type="button"
					className={`${s.actionBtn} ${activeSubTab === 'rules' ? s.actionBtnPrimary : ''}`}
					onClick={() => setActiveSubTab('rules')}
					style={{ padding: '8px 14px', fontSize: '12px' }}
				>
					<ShieldAlert size={14} />
					<span>{copy.tabRules}</span>
					{rulesApi.rules.length > 0 && (
						<span className={`${s.badge} ${s.badgeNeutral}`} style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px' }}>
							{rulesApi.rules.length}
						</span>
					)}
				</button>
			</div>

			{activeSubTab === 'quarantine' && (
				<>
					{canManage && (
						<QuarantineForm
							callerIp={callerIp}
							fwIp={fwIp}
							setFwIp={setFwIp}
							fwMode={fwMode}
							setFwMode={setFwMode}
							fwDuration={fwDuration}
							setFwDuration={setFwDuration}
							fwReason={fwReason}
							setFwReason={setFwReason}
							isSubmitting={isSubmitting}
							copy={copy}
							onSubmit={handleFirewallSubmit}
						/>
					)}

					<ActiveBansTable
						bans={bans}
						filteredBans={filteredBans}
						activeBansOnlyCount={activeBansOnlyCount}
						fwFilter={fwFilter}
						setFwFilter={setFwFilter}
						hasSearchQuery={Boolean(query)}
						canManage={canManage}
						isSubmitting={isSubmitting}
						language={language}
						copy={copy}
						onSelectDataDoubleClick={handleSelectDataOnDoubleClick}
						onContainerDoubleClick={handleDataContainerDoubleClick}
						handleUnban={handleUnban}
					/>

					<RateLimitsTable
						rateLimits={filteredRateLimits}
						hasSearchQuery={Boolean(query)}
						canManage={canManage}
						isSubmitting={isSubmitting}
						language={language}
						copy={copy}
						onSelectDataDoubleClick={handleSelectDataOnDoubleClick}
						onContainerDoubleClick={handleDataContainerDoubleClick}
						handleClearRateLimit={handleClearRateLimit}
					/>
				</>
			)}

			{activeSubTab === 'rules' && (
				<FirewallRulesPanel
					rulesApi={rulesApi}
					filteredRules={filteredRules}
					hasSearchQuery={Boolean(query)}
					canManage={canManage}
					language={language}
					copy={copy}
					onContainerDoubleClick={handleDataContainerDoubleClick}
				/>
			)}
		</div>
	);
});
