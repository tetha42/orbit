'use client';

import React from 'react';
import { Eye, Copy, ExternalLink, Pencil, Trash2, Megaphone, Rocket, GraduationCap, Handshake, ShieldAlert } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import type { NewsEntry } from '../types';
import type { MenuItem } from '@/types/workspace';

export function buildNewsCardMenu(
	article: NewsEntry,
	isAdmin: boolean,
	t: (key: string) => string,
	onSelect: () => void,
	onEdit: (e: React.MouseEvent) => void,
	onDelete: (e: React.MouseEvent) => void,
): MenuItem[] {
	const items: MenuItem[] = [
		{ id: 'read-news', label: t('ctxNewsRead'), icon: <Eye size={13} />, action: () => onSelect() },
		{ id: 'copy-title', label: t('ctxNewsCopyTitle'), icon: <Copy size={13} />, action: () => copyToClipboard(article.title) },
		{
			id: 'copy-link',
			label: t('ctxNewsCopyLink'),
			icon: <ExternalLink size={13} />,
			action: () => {
				const origin = typeof window !== 'undefined' ? window.location.origin : '';
				copyToClipboard(`${origin}/?app=news&id=${encodeURIComponent(article.id)}`);
			},
		},
	];

	if (isAdmin) {
		items.push(
			{ id: 'sep-news-admin', label: '', separator: true },
			{ id: 'edit-news', label: t('newsEdit'), icon: <Pencil size={13} />, action: () => onEdit({ stopPropagation: () => {} } as React.MouseEvent) },
			{ id: 'delete-news', label: t('newsDelete'), icon: <Trash2 size={13} />, danger: true, action: () => onDelete({ stopPropagation: () => {} } as React.MouseEvent) },
		);
	}
	return items;
}

export function getNewsCategoryMeta(category: string, t: (key: string) => string) {
	const categoryMap: Record<
		string,
		{ label: string; color: string; icon: React.ComponentType<{ size?: number; color?: string }> }
	> = {
		general: { label: t('newsCatGeneral'), color: 'var(--accent)', icon: Megaphone },
		teknofest: { label: t('newsCatTeknofest'), color: 'var(--warning)', icon: Rocket },
		workshop: { label: t('newsCatWorkshop'), color: 'var(--success)', icon: GraduationCap },
		collaboration: { label: t('newsCatPartner'), color: '#af52de', icon: Handshake },
		official: { label: t('newsCatOfficial'), color: 'var(--danger)', icon: ShieldAlert },
	};
	return categoryMap[category] || categoryMap.general;
}
