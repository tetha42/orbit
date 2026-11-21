'use client';

import { useEffect } from 'react';
import { useLiveEvent } from '@/core/session';

interface SocRefreshEffectsDeps {
	canView: boolean;
	autoRefresh: boolean;
	activeTab: string;
	fimTarget: string;
	fetchAll: (silent?: boolean) => Promise<void>;
	fetchInspectionData: (target?: string, forceFim?: boolean) => Promise<void>;
}

export function useSocRefreshEffects({
	canView,
	autoRefresh,
	activeTab,
	fimTarget,
	fetchAll,
	fetchInspectionData,
}: SocRefreshEffectsDeps) {
	useEffect(() => {
		const t = setTimeout(() => {
			void fetchAll(false);
		}, 0);
		return () => clearTimeout(t);
	}, [fetchAll]);

	useLiveEvent((event) => {
		if (event === 'soc_updated' && canView && (typeof document === 'undefined' || !document.hidden)) {
			void fetchAll(true);
		}
	});

	useEffect(() => {
		if (!autoRefresh || !canView) return;
		const timer = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			void fetchAll(true);
		}, 15_000);
		const onVisible = () => {
			if (typeof document !== 'undefined' && !document.hidden) {
				void fetchAll(true);
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [autoRefresh, canView, fetchAll]);

	useEffect(() => {
		if (activeTab === 'inspection') {
			const t = setTimeout(() => {
				void fetchInspectionData(fimTarget, false);
			}, 0);
			return () => clearTimeout(t);
		}
	}, [activeTab, fetchInspectionData, fimTarget]);
}
