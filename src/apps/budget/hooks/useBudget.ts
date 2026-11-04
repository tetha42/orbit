'use client';

import { useState } from 'react';
import { useSession } from '@/core/session';
import { useJsonResource } from '@/core/data/useJsonResource';
import type { VaultSummary } from '../types';
import { useFocusTarget } from '@/lib/client/useFocusTarget';

export function useBudget() {
	const { canUseApp } = useSession();
	const allowed = canUseApp('budget');

	const { data, refetch, httpStatus } = useJsonResource<{ vaults: VaultSummary[] }>(
		allowed ? '/api/budget/vaults' : null
	);
	const [selected, setSelected] = useState<string | null>(null);

	useFocusTarget('budget', {
		ready: data !== null,
		apply: (target) => {
			const vault = target.kind === 'vault' ? target.itemId : target.parentId;
			setSelected(vault && vault !== 'general' ? vault : null);
		},
		refetch,
	});

	const vaults = data?.vaults ?? [];
	const active = vaults.find((k) => k.teamId === selected) ?? vaults[0];
	const general = vaults.filter((k) => k.kind === 'general');
	const projects = vaults.filter((k) => k.kind === 'project');

	return {
		allowed,
		httpStatus,
		vaults,
		active,
		general,
		projects,
		selected,
		setSelected,
		refetch,
	};
}
