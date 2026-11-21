'use client';

import React from 'react';
import { Clock, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell/useContextMenu';
import { VisibilityBadge } from './VisibilityBadge';
import { buildNewsCardMenu, getNewsCategoryMeta } from './NewsCardHelpers';
import type { NewsEntry } from '../types';

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
	const menuItems = buildNewsCardMenu(article, isAdmin, t, onSelect, onEdit, onDelete);
	const contextMenuProps = useContextMenu({ items: menuItems });
	const cat = getNewsCategoryMeta(article.category, t);
	const CategoryIcon = cat.icon;

	return (
		<div
			onClick={onSelect}
			{...contextMenuProps}
			style={{
				background: 'rgba(255, 255, 255, 0.04)',
				border: article.isImportant === 1 ? '1px solid color-mix(in srgb, var(--danger) 35%, transparent)' : '1px solid rgba(255, 255, 255, 0.08)',
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
			{article.imageUrl && (
				<div
					style={{
						width: 'calc(100% + 40px)',
						margin: '-20px -20px 14px -20px',
						height: '110px',
						background: `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url(${article.imageUrl})`,
						backgroundSize: 'contain',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat',
						backgroundColor: 'rgba(0, 0, 0, 0.3)',
						borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
					}}
				/>
			)}

			<div>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
					<span
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '5px',
							fontSize: '10.5px',
							fontWeight: 700,
							padding: '3px 8px',
							borderRadius: '6px',
							background: `color-mix(in srgb, ${cat.color} 13%, transparent)`,
							color: cat.color,
						}}
					>
						<CategoryIcon size={12} />
						{cat.label}
					</span>

					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						{isAdmin && <VisibilityBadge visibility={article.publishStatus} />}
						{article.isImportant === 1 && (
							<span
						style={{
							fontSize: '9.5px',
							fontWeight: 800,
							padding: '2px 6px',
							borderRadius: '4px',
							background: 'color-mix(in srgb, var(--danger) 25%, transparent)',
							color: 'var(--danger)',
						}}
					>
								{t('newsImportant')}
							</span>
						)}
						<span style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px' }}>
							<Clock size={11} />
							{new Date(article.createdAt).toLocaleDateString(language, { day: 'numeric', month: 'short' })}
						</span>
					</div>
				</div>

				<h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.35 }}>
					{article.title}
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
					{article.summary}
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
					{article.authorName || t('newsAuthorDefault')}
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
								color: 'var(--danger)',
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
