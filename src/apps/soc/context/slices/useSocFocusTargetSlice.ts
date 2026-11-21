'use client';

import { useEffect, useRef } from 'react';
import { useWindowFocusTarget } from '@/core/windows';
import type { SocTab, SiemSearchOp, SiemSearchField } from '../../types';

interface FocusTargetDeps {
	setActiveTabState: (v: SocTab) => void;
	setSiemSearch: (v: string) => void;
	setSiemSearchField: (v: SiemSearchField) => void;
	setSiemSearchOp: (v: SiemSearchOp) => void;
	setSiemIp: (v: string) => void;
	setSiemIpOp: (v: 'eq' | 'neq' | 'contains' | 'not_contains') => void;
	setFwIp: (v: string) => void;
}

export function useSocFocusTargetSlice(deps: FocusTargetDeps) {
	const { focusTarget, clearFocusTarget } = useWindowFocusTarget('soc');
	const depsRef = useRef(deps);

	useEffect(() => {
		depsRef.current = deps;
	});

	useEffect(() => {
		if (!focusTarget || focusTarget.appId !== 'soc') return;
		const d = depsRef.current;
		if (focusTarget.section === 'siem') {
			d.setActiveTabState('siem');
			if (focusTarget.kind === 'user' && focusTarget.itemId) {
				d.setSiemSearch(focusTarget.itemId);
				d.setSiemSearchField('userId');
				d.setSiemSearchOp('equals');
			} else if (focusTarget.kind === 'ip' && focusTarget.itemId) {
				d.setSiemIp(focusTarget.itemId);
				d.setSiemIpOp('eq');
			}
		} else if (focusTarget.section === 'firewall') {
			d.setActiveTabState('firewall');
			if (focusTarget.itemId) {
				d.setFwIp(focusTarget.itemId);
			}
		} else if (focusTarget.section === 'sessions') {
			d.setActiveTabState('sessions');
		} else if (focusTarget.section === 'radar') {
			d.setActiveTabState('radar');
		}
		clearFocusTarget(focusTarget.nonce);
	}, [focusTarget, clearFocusTarget]);
}
