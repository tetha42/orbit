import { useState, useEffect, useCallback } from 'react';
import type { SecurityRule, SecurityRuleCondition, RuleAction, MatchMode } from '@/lib/securityRules';

export interface SimResult {
	matched: boolean;
	ruleName: string | null;
	action: string;
	evaluationTimeUs?: number;
	scoreIncrement?: number;
}

export function useFirewallRules(activeSubTab: 'quarantine' | 'rules') {
	const [rules, setRules] = useState<SecurityRule[]>([]);
	const [isLoadingRules, setIsLoadingRules] = useState(false);
	const [showCreatorModal, setShowCreatorModal] = useState(false);
	const [showSimulator, setShowSimulator] = useState(false);

	const [ruleName, setRuleName] = useState('');
	const [ruleDesc, setRuleDesc] = useState('');
	const [rulePriority, setRulePriority] = useState(100);
	const [ruleMatchMode, setRuleMatchMode] = useState<MatchMode>('all');
	const [ruleAction, setRuleAction] = useState<RuleAction>('block');
	const [rateLimitCount, setRateLimitCount] = useState(30);
	const [rateLimitWindow, setRateLimitWindow] = useState(60000);
	const [scorePoints, setScorePoints] = useState(20);
	const [ruleConditions, setRuleConditions] = useState<SecurityRuleCondition[]>([
		{ type: 'path_pattern', value: '/api/admin/**' },
	]);
	const [isSavingRule, setIsSavingRule] = useState(false);

	const [simMethod, setSimMethod] = useState('GET');
	const [simPath, setSimPath] = useState('/api/admin/users');
	const [simIp, setSimIp] = useState('198.51.100.42');
	const [simHeaders, setSimHeaders] = useState('user-agent: OffensiveScanner/1.0');
	const [simBody, setSimBody] = useState('');
	const [isSimulating, setIsSimulating] = useState(false);
	const [simResult, setSimResult] = useState<SimResult | null>(null);

	const fetchRules = useCallback(async () => {
		setIsLoadingRules(true);
		try {
			const res = await fetch('/api/soc/rules', { cache: 'no-store' });
			const data = await res.json().catch(() => ({}));
			if (res.ok && Array.isArray(data.rules)) {
				setRules(data.rules);
			}
		} catch {
			// ignore fetch error
		} finally {
			setIsLoadingRules(false);
		}
	}, []);

	useEffect(() => {
		if (activeSubTab === 'rules') {
			void fetchRules();
		}
	}, [activeSubTab, fetchRules]);

	const handleAddCondition = () => {
		setRuleConditions((prev) => [...prev, { type: 'path_pattern', value: '' }]);
	};

	const handleRemoveCondition = (index: number) => {
		setRuleConditions((prev) => prev.filter((_, i) => i !== index));
	};

	const handleUpdateCondition = (index: number, patch: Partial<SecurityRuleCondition>) => {
		setRuleConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
	};

	const handleSaveRule = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!ruleName.trim()) return;
		setIsSavingRule(true);

		const actionConfig: Record<string, unknown> = {};
		if (ruleAction === 'rate_limit') {
			actionConfig.limit = rateLimitCount;
			actionConfig.windowMs = rateLimitWindow;
		} else if (ruleAction === 'score') {
			actionConfig.points = scorePoints;
		}

		try {
			const res = await fetch('/api/soc/rules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: ruleName.trim(),
					description: ruleDesc.trim() || undefined,
					priority: rulePriority,
					matchMode: ruleMatchMode,
					action: ruleAction,
					actionConfig,
					conditions: ruleConditions.filter((c) => c.value.trim() !== ''),
				}),
			});
			if (res.ok) {
				setShowCreatorModal(false);
				setRuleName('');
				setRuleDesc('');
				setRuleConditions([{ type: 'path_pattern', value: '/api/admin/**' }]);
				await fetchRules();
			}
		} catch {
			// ignore
		} finally {
			setIsSavingRule(false);
		}
	};

	const handleToggleRule = async (rule: SecurityRule) => {
		try {
			await fetch('/api/soc/rules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: rule.id,
					name: rule.name,
					enabled: !rule.enabled,
					priority: rule.priority,
					matchMode: rule.matchMode,
					action: rule.action,
					actionConfig: rule.actionConfig,
					conditions: rule.conditions,
				}),
			});
			await fetchRules();
		} catch {
			// ignore
		}
	};

	const handleDeleteRule = async (id: string) => {
		try {
			await fetch(`/api/soc/rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
			await fetchRules();
		} catch {
			// ignore
		}
	};

	const handleRunSimulation = async () => {
		setIsSimulating(true);
		setSimResult(null);
		const headerMap: Record<string, string> = {};
		for (const line of simHeaders.split('\n')) {
			const idx = line.indexOf(':');
			if (idx > 0) {
				headerMap[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
			}
		}

		try {
			const res = await fetch('/api/soc/rules/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mockRequest: {
						method: simMethod,
						pathname: simPath,
						ip: simIp,
						headers: headerMap,
						bodyPayload: simBody || undefined,
					},
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.result) {
				setSimResult(data.result);
			}
		} catch {
			// ignore
		} finally {
			setIsSimulating(false);
		}
	};

	return {
		rules,
		isLoadingRules,
		showCreatorModal,
		setShowCreatorModal,
		showSimulator,
		setShowSimulator,
		ruleName,
		setRuleName,
		ruleDesc,
		setRuleDesc,
		rulePriority,
		setRulePriority,
		ruleMatchMode,
		setRuleMatchMode,
		ruleAction,
		setRuleAction,
		rateLimitCount,
		setRateLimitCount,
		rateLimitWindow,
		setRateLimitWindow,
		scorePoints,
		setScorePoints,
		ruleConditions,
		isSavingRule,
		simMethod,
		setSimMethod,
		simPath,
		setSimPath,
		simIp,
		setSimIp,
		simHeaders,
		setSimHeaders,
		simBody,
		setSimBody,
		isSimulating,
		simResult,
		fetchRules,
		handleAddCondition,
		handleRemoveCondition,
		handleUpdateCondition,
		handleSaveRule,
		handleToggleRule,
		handleDeleteRule,
		handleRunSimulation,
	};
}
