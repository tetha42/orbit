'use client';

import { useState } from 'react';
import { useSession } from '@/core/session';
import { useJsonResource } from '@/core/data/useJsonResource';
import type { KasaSummary } from '../types';
import { useFocusTarget } from '@/lib/client/useFocusTarget';

export function useBudget() {
	const { canUseApp } = useSession();
	const allowed = canUseApp('budget');

	const { data, refetch, httpStatus } = useJsonResource<{ kasalar: KasaSummary[] }>(
		allowed ? '/api/budget/vaults' : null
	);
	const [selected, setSelected] = useState<string | null>(null);

	useFocusTarget('budget', {
		ready: data !== null,
		apply: (target) => {
			const kasa = target.kind === 'kasa' ? target.itemId : target.parentId;
			setSelected(kasa && kasa !== 'genel' ? kasa : null);
		},
		refetch,
	});

	const kasalar = data?.kasalar ?? [];
	const active = kasalar.find((k) => k.teamId === selected) ?? kasalar[0];
	const general = kasalar.filter((k) => k.kind === 'genel');
	const projects = kasalar.filter((k) => k.kind === 'proje');

	return {
		allowed,
		httpStatus,
		kasalar,
		active,
		general,
		projects,
		selected,
		setSelected,
		refetch,
	};
}
