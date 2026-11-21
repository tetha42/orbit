'use client';

import React from 'react';
import { Pencil, Trash2, Share2, Check, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { NEWS_VISIBILITIES, type NewsVisibility } from '@/types/news';
import type { NewsEntry } from '../types';

interface NewsDetailHeaderProps {
	article: NewsEntry;
	isAdmin: boolean;
	copied: boolean;
	onHeaderMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
	onHeaderDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onShare: () => void;
	onChangeVisibility: (visibility: NewsVisibility) => void;
}

export function NewsDetailHeader({
	article,
	isAdmin,
	copied,
	onHeaderMouseDown,
	onHeaderDoubleClick,
	onClose,
	onEdit,
	onDelete,
	onShare,
	onChangeVisibility,
}: NewsDetailHeaderProps) {
	const { t } = useI18n();

	const categoryMap: Record<string, string> = {
		general: t('newsCatGeneral'),
		teknofest: t('newsCatTeknofest'),
		workshop: t('newsCatWorkshop'),
		collaboration: t('newsCatPartner'),
		official: t('newsCatOfficial'),
	};

	const visibilityLabels: Record<NewsVisibility, string> = {
		draft: t('newsVisDraft'),
		members: t('newsVisMembers'),
		published: t('newsVisPublic'),
	};

	return (
		<div
			onMouseDown={onHeaderMouseDown}
			onDoubleClick={onHeaderDoubleClick}
			style={{
				padding: '16px 24px',
				borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				background: 'rgba(255, 255, 255, 0.03)',
				cursor: 'grab',
				userSelect: 'none',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
				<span
					style={{
						fontSize: '11px',
						fontWeight: 800,
						padding: '3px 8px',
						borderRadius: '6px',
						background: 'color-mix(in srgb, var(--danger) 20%, transparent)',
						color: 'var(--danger)',
					}}
				>
					{categoryMap[article.category] || t('newsCatGeneral')}
				</span>
				<span style={{ fontSize: '12px', opacity: 0.65 }}>{t('newsOfficialNotice')}</span>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				{isAdmin && (
					<select
						value={article.publishStatus}
						onChange={(e) => onChangeVisibility(e.target.value as NewsVisibility)}
						aria-label={t('newsWhoCanSee')}
						style={{
							padding: '6px 8px',
							borderRadius: '8px',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							background: 'rgba(255, 255, 255, 0.06)',
							color: 'inherit',
							fontSize: '12px',
							cursor: 'pointer',
						}}
					>
						{NEWS_VISIBILITIES.map((value) => (
							<option key={value} value={value}>
								{visibilityLabels[value]}
							</option>
						))}
					</select>
				)}
				{isAdmin && (
					<button
						onClick={onEdit}
						title={t('newsEdit')}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							padding: '6px 12px',
							borderRadius: '8px',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							background: 'transparent',
							color: 'inherit',
							fontSize: '12px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						<Pencil size={13} />
						<span>{t('edit')}</span>
					</button>
				)}
				{isAdmin && (
					<button
						onClick={onDelete}
						title={t('newsDelete')}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							padding: '6px 12px',
							borderRadius: '8px',
							border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
							background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
							color: 'var(--danger)',
							fontSize: '12px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						<Trash2 size={13} />
						<span>{t('delete')}</span>
					</button>
				)}

				<button
					onClick={onShare}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						padding: '6px 12px',
						borderRadius: '8px',
						border: '1px solid rgba(255, 255, 255, 0.15)',
						background: 'transparent',
						color: 'inherit',
						fontSize: '12px',
						cursor: 'pointer',
					}}
				>
					{copied ? <Check size={13} color="var(--success)" /> : <Share2 size={13} />}
					<span>{copied ? t('newsShareCopied') : t('newsShare')}</span>
				</button>

				<button
					onClick={onClose}
					style={{
						background: 'rgba(255, 255, 255, 0.1)',
						border: 'none',
						borderRadius: '50%',
						width: '28px',
						height: '28px',
						color: '#fff',
						cursor: 'pointer',
						display: 'grid',
						placeItems: 'center',
					}}
				>
					<X size={15} />
				</button>
			</div>
		</div>
	);
}
