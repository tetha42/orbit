'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import type { NewsVisibility } from '@/types/news';
import type { NewsEntry } from '../types';
import { NewsDetailHeader } from './NewsDetailHeader';

interface NewsDetailModalProps {
	article: NewsEntry;
	isAdmin: boolean;
	copied: boolean;
	onClose: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onShare: () => void;
	onChangeVisibility: (visibility: NewsVisibility) => void;
}

export function NewsDetailModal({
	article,
	isAdmin,
	copied,
	onClose,
	onEdit,
	onDelete,
	onShare,
	onChangeVisibility,
}: NewsDetailModalProps) {
	const { t, language } = useI18n();
	const { offset, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(true);

	return (
		<ModalOverlay onClose={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={article.title}
				data-focus-id={`news:${article.id}`}
				style={{
					width: '100%',
					maxWidth: '740px',
					maxHeight: 'calc(100vh - 64px)',
					background: 'var(--modal-bg, #ffffff)',
					border: '1px solid var(--window-border)',
					boxShadow: 'var(--shadow-window-active, 0 24px 60px rgba(0, 0, 0, 0.6))',
					borderRadius: '18px',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					...(offset.x !== 0 || offset.y !== 0 ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` } : {}),
				}}
			>
				<NewsDetailHeader
					article={article}
					isAdmin={isAdmin}
					copied={copied}
					onHeaderMouseDown={onHeaderMouseDown}
					onHeaderDoubleClick={onHeaderDoubleClick}
					onClose={onClose}
					onEdit={onEdit}
					onDelete={onDelete}
					onShare={onShare}
					onChangeVisibility={onChangeVisibility}
				/>

				<div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
					{article.imageUrl && (
						<div
							style={{
								width: '100%',
								height: '180px',
								borderRadius: '12px',
								marginBottom: '20px',
								background: `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.5)), url(${article.imageUrl})`,
								backgroundSize: 'contain',
								backgroundPosition: 'center',
								backgroundRepeat: 'no-repeat',
								backgroundColor: 'rgba(0, 0, 0, 0.25)',
								border: '1px solid rgba(255, 255, 255, 0.1)',
							}}
						/>
					)}

					<h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 14px 0', lineHeight: 1.35 }}>
						{article.title}
					</h1>

					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							fontSize: '12.5px',
							opacity: 0.7,
							marginBottom: '24px',
							paddingBottom: '16px',
							borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
						}}
					>
						<span>
							{t('newsPublishedBy')} <strong>{article.authorName || t('newsAuthorDefault')}</strong>
						</span>
						<span>•</span>
						<span>
							{t('newsDate')}{' '}
							{new Date(article.createdAt).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })}
						</span>
						{article.isImportant === 1 && (
							<>
								<span>•</span>
								<span style={{ color: 'var(--danger)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
									<ShieldAlert size={12} /> {t('newsUrgentBadge')}
								</span>
							</>
						)}
					</div>

					<div style={{ fontSize: '15px', lineHeight: 1.75, opacity: 0.9, whiteSpace: 'pre-line' }}>
						{article.content}
					</div>
				</div>
			</div>
		</ModalOverlay>
	);
}
