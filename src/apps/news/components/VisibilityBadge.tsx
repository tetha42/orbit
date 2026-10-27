'use client';

import React from 'react';
import { FilePen, Lock, Globe } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { NewsVisibility } from '@/types/news';

export function VisibilityBadge({ visibility }: { visibility: NewsVisibility }) {
	const { t } = useI18n();

	const visibilityBadges: Record<
		NewsVisibility,
		{ color: string; icon: React.ComponentType<{ size?: number; color?: string }>; hint: string; label: string }
	> = {
		taslak: { color: '#8e8e93', icon: FilePen, hint: t('newsVisDraftHint'), label: t('newsVisDraft') },
		uyeler: { color: '#0a84ff', icon: Lock, hint: t('newsVisMembersHint'), label: t('newsVisMembers') },
		yayinda: { color: '#30d158', icon: Globe, hint: t('newsVisPublicHint'), label: t('newsVisPublic') },
	};

	const b = visibilityBadges[visibility];
	const Icon = b.icon;
	return (
		<span
			title={b.hint}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '4px',
				fontSize: '10px',
				fontWeight: 700,
				padding: '2px 6px',
				borderRadius: '4px',
				background: `${b.color}22`,
				color: b.color,
			}}
		>
			<Icon size={10} />
			{b.label}
		</span>
	);
}
