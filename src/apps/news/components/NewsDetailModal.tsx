'use client';

import React from 'react';
import {
	Pencil,
	Trash2,
	Share2,
	Check,
	X,
	ShieldAlert,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import { NEWS_VISIBILITIES, type NewsVisibility } from '@/types/news';
import type { HaberItem } from '../types';

interface NewsDetailModalProps {
	article: HaberItem;
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

	const categoryMap: Record<string, string> = {
		genel: t('newsCatGenel'),
		teknofest: t('newsCatTeknofest'),
		atolye: t('newsCatAtolye'),
		isbirligi: t('newsCatIsbirligi'),
		resmi: t('newsCatResmi'),
	};

	const visibilityLabels: Record<NewsVisibility, string> = {
		taslak: t('newsVisDraft'),
		uyeler: t('newsVisMembers'),
		yayinda: t('newsVisPublic'),
	};

	return (
		<ModalOverlay onClose={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={article.baslik}
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
					...(offset.x !== 0 || offset.y !== 0
						? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
						: {}),
				}}
			>
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
								background: 'rgba(255, 45, 85, 0.2)',
								color: '#ff2d55',
							}}
						>
							{categoryMap[article.kategori] || t('newsCatGenel')}
						</span>
						<span style={{ fontSize: '12px', opacity: 0.65 }}>
							{t('newsOfficialNotice')}
						</span>
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
									border: '1px solid rgba(255, 69, 58, 0.3)',
									background: 'rgba(255, 69, 58, 0.1)',
									color: '#ff453a',
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
							{copied ? <Check size={13} color="#30d158" /> : <Share2 size={13} />}
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

				<div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
					{article.resimUrl && (
						<div
							style={{
								width: '100%',
								height: '180px',
								borderRadius: '12px',
								marginBottom: '20px',
								background: `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.5)), url(${article.resimUrl})`,
								backgroundSize: 'contain',
								backgroundPosition: 'center',
								backgroundRepeat: 'no-repeat',
								backgroundColor: 'rgba(0, 0, 0, 0.25)',
								border: '1px solid rgba(255, 255, 255, 0.1)',
							}}
						/>
					)}

					<h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 14px 0', lineHeight: 1.35 }}>
						{article.baslik}
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
							{t('newsPublishedBy')} <strong>{article.yazarAdSoyad || t('newsAuthorDefault')}</strong>
						</span>
						<span>•</span>
						<span>
							{t('newsDate')}{' '}
							{new Date(article.olusturma).toLocaleDateString(
								language === 'tr' ? 'tr-TR' : 'en-US',
								{ day: 'numeric', month: 'long', year: 'numeric' }
							)}
						</span>
						{article.onemliMi === 1 && (
							<>
								<span>•</span>
								<span style={{ color: '#ff2d55', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
									<ShieldAlert size={12} /> {t('newsUrgentBadge')}
								</span>
							</>
						)}
					</div>

					<div
						style={{
							fontSize: '15px',
							lineHeight: 1.75,
							opacity: 0.9,
							whiteSpace: 'pre-line',
						}}
					>
						{article.icerik}
					</div>
				</div>
			</div>
		</ModalOverlay>
	);
}
