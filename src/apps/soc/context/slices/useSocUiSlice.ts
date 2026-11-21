'use client';

import { useState, useCallback } from 'react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import type { SocTab, TestbenchTab, IngressDiagnostics } from '../../types';
import { SOC_LAB_TABS } from '../../types';
import type { useTestbench } from '../../testbench/hooks/useTestbench';

export function useSocUiSlice(tb: ReturnType<typeof useTestbench>) {
	const { isAdmin, canUseApp, canManageApp } = useSession();
	const { language } = useI18n();

	const canView = isAdmin || canUseApp('soc');
	const canManage = isAdmin || canManageApp('soc');

	const [activeTab, setActiveTabState] = useState<SocTab>('radar');
	const [globalSearch, setGlobalSearch] = useState<string>('');
	const [currentUserId, setCurrentUserId] = useState<string>('');
	const [callerIp, setCallerIp] = useState<string>('');
	const [ingressDiagnostics, setIngressDiagnostics] = useState<IngressDiagnostics | null>(null);

	const [liveTail, setLiveTail] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
	const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

	const showNotice = useCallback((type: 'ok' | 'err', text: string) => {
		setBanner({ type, text });
	}, []);

	const setActiveTab = useCallback((tab: SocTab) => {
		setBanner(null);
		setActiveTabState(tab);
	}, []);

	const openLabTab = useCallback(
		(requested: TestbenchTab) => {
			const tab = canManage || SOC_LAB_TABS.includes(requested) ? requested : 'api';
			setActiveTab(tab);
			if (tab === 'api' && tb.apiItems.length === 0 && !tb.isRunningSuite) {
				void tb.runApiSuite();
			}
		},
		[canManage, setActiveTab, tb]
	);

	return {
		language,
		canView,
		canManage,
		activeTab,
		setActiveTabState,
		setActiveTab,
		openLabTab,
		globalSearch,
		setGlobalSearch,
		currentUserId,
		setCurrentUserId,
		callerIp,
		setCallerIp,
		ingressDiagnostics,
		setIngressDiagnostics,
		liveTail,
		setLiveTail,
		isLoading,
		setIsLoading,
		isSubmitting,
		setIsSubmitting,
		autoRefresh,
		setAutoRefresh,
		banner,
		setBanner,
		showNotice,
	};
}
