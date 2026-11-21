'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import type { NewsVisibility } from '@/types/news';
import { NewsVisibilitySection, getVisibilityMeta } from './NewsVisibilitySection';
import { NewsFormFields } from './NewsFormFields';

interface NewsFormModalProps {
	editingId: string | null;
	formError: string | null;
	isSubmitting: boolean;
	newVisibility: NewsVisibility;
	newCategory: string;
	newIsImportant: boolean;
	newTitle: string;
	newSummary: string;
	newImageUrl: string;
	newContent: string;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
	onChangeVisibility: (v: NewsVisibility) => void;
	onChangeCategory: (c: string) => void;
	onChangeIsImportant: (val: boolean) => void;
	onChangeTitle: (val: string) => void;
	onChangeSummary: (val: string) => void;
	onChangeImageUrl: (val: string) => void;
	onChangeContent: (val: string) => void;
}

export function NewsFormModal({
	editingId,
	formError,
	isSubmitting,
	newVisibility,
	newCategory,
	newIsImportant,
	newTitle,
	newSummary,
	newImageUrl,
	newContent,
	onClose,
	onSubmit,
	onChangeVisibility,
	onChangeCategory,
	onChangeIsImportant,
	onChangeTitle,
	onChangeSummary,
	onChangeImageUrl,
	onChangeContent,
}: NewsFormModalProps) {
	const { t } = useI18n();
	const { offset, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(true);
	const visibilityBadges = getVisibilityMeta(t);

	return (
		<ModalOverlay onClose={onClose}>
			<form
				role="dialog"
				aria-modal="true"
				aria-label={editingId ? t('newsEditTitle') : t('newsNewTitle')}
				onSubmit={onSubmit}
				style={{
					width: '100%',
					maxWidth: '640px',
					maxHeight: 'calc(100vh - 64px)',
					background: 'var(--modal-bg, #ffffff)',
					border: '1px solid var(--window-border)',
					boxShadow: 'var(--shadow-window-active, 0 24px 60px rgba(0, 0, 0, 0.6))',
					borderRadius: '16px',
					padding: '22px 26px',
					display: 'flex',
					flexDirection: 'column',
					gap: '14px',
					overflowY: 'auto',
					boxSizing: 'border-box',
					...(offset.x !== 0 || offset.y !== 0
						? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
						: {}),
				}}
			>
				<div
					onMouseDown={onHeaderMouseDown}
					onDoubleClick={onHeaderDoubleClick}
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						cursor: 'grab',
						userSelect: 'none',
					}}
				>
					<div>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
								{editingId ? t('newsEditTitle') : t('newsNewTitle')}
							</h3>
							<span
								style={{
									fontSize: '10.5px',
									padding: '2px 8px',
									borderRadius: '10px',
									background: 'color-mix(in srgb, var(--danger) 20%, transparent)',
									color: 'var(--danger)',
									fontWeight: 700,
								}}
							>
								{t('newsAdminPanel')}
							</span>
						</div>
						<div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
							{visibilityBadges[newVisibility].hint}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6 }}
					>
						<X size={18} />
					</button>
				</div>

				{formError && (
					<div
						style={{
							padding: '10px 14px',
							borderRadius: '8px',
							background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
							border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
							color: 'var(--danger)',
							fontSize: '12.5px',
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
						}}
					>
						<AlertTriangle size={15} style={{ flexShrink: 0 }} />
						<span>{formError}</span>
					</div>
				)}

				<NewsVisibilitySection
					newVisibility={newVisibility}
					newCategory={newCategory}
					newIsImportant={newIsImportant}
					onChangeVisibility={onChangeVisibility}
					onChangeCategory={onChangeCategory}
					onChangeIsImportant={onChangeIsImportant}
				/>

				<NewsFormFields
					editingId={editingId}
					isSubmitting={isSubmitting}
					newVisibility={newVisibility}
					newTitle={newTitle}
					newSummary={newSummary}
					newImageUrl={newImageUrl}
					newContent={newContent}
					onClose={onClose}
					onChangeTitle={onChangeTitle}
					onChangeSummary={onChangeSummary}
					onChangeImageUrl={onChangeImageUrl}
					onChangeContent={onChangeContent}
				/>
			</form>
		</ModalOverlay>
	);
}
