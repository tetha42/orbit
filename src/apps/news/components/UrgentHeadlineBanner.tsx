'use client';

import React from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { NewsEntry } from '../types';

interface UrgentHeadlineBannerProps {
	article: NewsEntry;
	isAdmin: boolean;
	deletingId: string | null;
	onSelect: (article: NewsEntry) => void;
	onDelete: (id: string, e: React.MouseEvent) => void;
}

export function UrgentHeadlineBanner({
	article,
	isAdmin,
	deletingId,
	onSelect,
	onDelete,
}: UrgentHeadlineBannerProps) {
	const { t, language } = useI18n();

	return (
		<div
			onClick={() => onSelect(article)}
			style={{
				marginBottom: '24px',
				padding: '20px 24px',
				borderRadius: '16px',
				background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.22), rgba(10, 132, 255, 0.16))',
				border: '1px solid rgba(255, 45, 85, 0.45)',
				boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
				cursor: 'pointer',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				gap: '20px',
				transition: 'transform 140ms ease, box-shadow 140ms ease',
			}}
		>
			<div style={{ flex: 1 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
					<span
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							padding: '3px 9px',
							borderRadius: '12px',
							background: '#ff2d55',
							color: '#fff',
							fontSize: '10px',
							fontWeight: 800,
							letterSpacing: '0.5px',
							boxShadow: '0 2px 8px rgba(255, 45, 85, 0.4)',
						}}
					>
						<ShieldAlert size={12} /> {t('newsHeadline')}
					</span>
					<span style={{ fontSize: '11px', opacity: 0.7 }}>
						{new Date(article.olusturma).toLocaleDateString(
							language === 'tr' ? 'tr-TR' : 'en-US',
							{ day: 'numeric', month: 'long', year: 'numeric' }
						)}
					</span>
				</div>
				<h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0', lineHeight: 1.3 }}>
					{article.baslik}
				</h3>
				<p style={{ margin: 0, fontSize: '13px', opacity: 0.85, lineHeight: 1.45, maxWidth: '800px' }}>
					{article.ozet}
				</p>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				{isAdmin && (
					<button
						onClick={(e) => onDelete(article.id, e)}
						disabled={deletingId === article.id}
						title={t('newsDelete')}
						style={{
							padding: '8px',
							borderRadius: '8px',
							border: '1px solid rgba(255, 69, 58, 0.3)',
							background: 'rgba(255, 69, 58, 0.1)',
							color: '#ff453a',
							cursor: 'pointer',
						}}
					>
						<Trash2 size={16} />
					</button>
				)}
				<button
					style={{
						padding: '8px 18px',
						borderRadius: '10px',
						border: '1px solid rgba(255, 255, 255, 0.25)',
						background: 'rgba(255, 255, 255, 0.15)',
						color: '#fff',
						fontSize: '12.5px',
						fontWeight: 700,
						cursor: 'pointer',
						whiteSpace: 'nowrap',
						flexShrink: 0,
					}}
				>
					{t('newsReadArticle')}
				</button>
			</div>
		</div>
	);
}
