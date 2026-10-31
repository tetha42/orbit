'use client';

import React from 'react';
import {
	Clock,
	Pencil,
	Trash2,
	Megaphone,
	Rocket,
	GraduationCap,
	Handshake,
	ShieldAlert,
	Eye,
	Copy,
	ExternalLink,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell/useContextMenu';
import { copyToClipboard } from '@/lib/clipboard';
import { VisibilityBadge } from './VisibilityBadge';
import type { NewsEntry } from '../types';
import type { MenuItem } from '@/types/workspace';

interface NewsCardProps {
	article: NewsEntry;
	isAdmin: boolean;
	deletingId: string | null;
	onSelect: () => void;
	onEdit: (e: React.MouseEvent) => void;
	onDelete: (e: React.MouseEvent) => void;
}

export function NewsCard({
	article,
	isAdmin,
	deletingId,
	onSelect,
	onEdit,
	onDelete,
}: NewsCardProps) {
	const { t, language } = useI18n();

	const menuItems: MenuItem[] = [
		{
			id: 'read-news',
			label: t('ctxNewsRead'),
			icon: <Eye size={13} />,
			action: () => onSelect(),
		},
		{
			id: 'copy-title',
			label: t('ctxNewsCopyTitle'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(article.baslik),
		},
		{
			id: 'copy-link',
			label: t('ctxNewsCopyLink'),
			icon: <ExternalLink size={13} />,
			action: () => {
				const origin = typeof window !== 'undefined' ? window.location.origin : '';
				copyToClipboard(`${origin}/haberler/${article.slug || article.id}`);
			},
		},
	];

	if (isAdmin) {
		menuItems.push(
			{ id: 'sep-news-admin', label: '', separator: true },
			{
				id: 'edit-news',
				label: t('newsEdit'),
				icon: <Pencil size={13} />,
				action: () => onEdit({ stopPropagation: () => {} } as React.MouseEvent),
			},
			{
				id: 'delete-news',
				label: t('newsDelete'),
				icon: <Trash2 size={13} />,
				danger: true,
				action: () => onDelete({ stopPropagation: () => {} } as React.MouseEvent),
			}
		);
	}

	const contextMenuProps = useContextMenu({ items: menuItems });

	const categoryMap: Record<
		string,
		{ label: string; color: string; icon: React.ComponentType<{ size?: number; color?: string }> }
	> = {
		genel: { label: t('newsCatGenel'), color: '#0a84ff', icon: Megaphone },
		teknofest: { label: t('newsCatTeknofest'), color: '#ff9500', icon: Rocket },
		atolye: { label: t('newsCatAtolye'), color: '#30d158', icon: GraduationCap },
		isbirligi: { label: t('newsCatIsbirligi'), color: '#af52de', icon: Handshake },
		resmi: { label: t('newsCatResmi'), color: '#ff2d55', icon: ShieldAlert },
	};

	const cat = categoryMap[article.kategori] || categoryMap.genel;
	const CategoryIcon = cat.icon;

	return (
		<div
			onClick={onSelect}
			{...contextMenuProps}
			style={{
				background: 'rgba(255, 255, 255, 0.04)',
				border:
					article.onemliMi === 1
						? '1px solid rgba(255, 45, 85, 0.35)'
						: '1px solid rgba(255, 255, 255, 0.08)',
				borderRadius: '14px',
				padding: '20px',
				cursor: 'pointer',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				transition: 'all 150ms ease',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			{article.resimUrl && (
				<div
					style={{
						width: 'calc(100% + 40px)',
						margin: '-20px -20px 14px -20px',
						height: '110px',
						background: `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url(${article.resimUrl})`,
						backgroundSize: 'contain',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat',
						backgroundColor: 'rgba(0, 0, 0, 0.3)',
						borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
					}}
				/>
			)}

			<div>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '10px',
					}}
				>
					<span
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '5px',
							fontSize: '10.5px',
							fontWeight: 700,
							padding: '3px 8px',
							borderRadius: '6px',
							background: `${cat.color}20`,
							color: cat.color,
						}}
					>
						<CategoryIcon size={12} />
						{cat.label}
					</span>

					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						{isAdmin && <VisibilityBadge visibility={article.publishStatus} />}
						{article.onemliMi === 1 && (
							<span
								style={{
									fontSize: '9.5px',
									fontWeight: 800,
									padding: '2px 6px',
									borderRadius: '4px',
									background: 'rgba(255, 45, 85, 0.25)',
									color: '#ff2d55',
								}}
							>
								{t('newsImportant')}
							</span>
						)}
						<span
							style={{
								fontSize: '11px',
								opacity: 0.6,
								display: 'flex',
								alignItems: 'center',
								gap: '4px',
							}}
						>
							<Clock size={11} />
							{new Date(article.olusturma).toLocaleDateString(
								language === 'tr' ? 'tr-TR' : 'en-US',
								{ day: 'numeric', month: 'short' }
							)}
						</span>
					</div>
				</div>

				<h4
					style={{
						fontSize: '15px',
						fontWeight: 700,
						margin: '0 0 8px 0',
						lineHeight: 1.35,
					}}
				>
					{article.baslik}
				</h4>

				<p
					style={{
						fontSize: '12.5px',
						opacity: 0.75,
						lineHeight: 1.5,
						margin: 0,
						display: '-webkit-box',
						WebkitLineClamp: 3,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden',
					}}
				>
					{article.ozet}
				</p>
			</div>

			<div
				style={{
					marginTop: '16px',
					paddingTop: '12px',
					borderTop: '1px solid rgba(255, 255, 255, 0.06)',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
				}}
			>
				<span style={{ fontSize: '11.5px', opacity: 0.6 }}>
					{article.yazarAdSoyad || t('newsAuthorDefault')}
				</span>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{isAdmin && (
						<button
							onClick={onEdit}
							title={t('newsEdit')}
							aria-label={t('newsEdit')}
							style={{
								background: 'transparent',
								border: 'none',
								color: 'inherit',
								cursor: 'pointer',
								padding: '4px',
								borderRadius: '4px',
								display: 'grid',
								placeItems: 'center',
								opacity: 0.7,
							}}
						>
							<Pencil size={14} />
						</button>
					)}
					{isAdmin && (
						<button
							onClick={onDelete}
							disabled={deletingId === article.id}
							title={t('newsDelete')}
							style={{
								background: 'transparent',
								border: 'none',
								color: '#ff453a',
								cursor: 'pointer',
								padding: '4px',
								borderRadius: '4px',
								display: 'grid',
								placeItems: 'center',
								opacity: 0.8,
							}}
						>
							<Trash2 size={14} />
						</button>
					)}

					<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
						{t('newsRead')}
					</span>
				</div>
			</div>
		</div>
	);
}
