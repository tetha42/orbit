'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { NEWS_LIMITS, type NewsVisibility } from '@/types/news';
import newsContract from '../news.contract.json';
import { NewsBannerPicker } from './NewsBannerPicker';

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '9px 12px',
	borderRadius: '8px',
	background: 'rgba(0, 0, 0, 0.3)',
	border: '1px solid rgba(255, 255, 255, 0.15)',
	color: 'inherit',
	fontSize: '13px',
};

const labelStyle: React.CSSProperties = {
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.8,
	display: 'block',
	marginBottom: '4px',
};

interface NewsFormFieldsProps {
	editingId: string | null;
	isSubmitting: boolean;
	newVisibility: NewsVisibility;
	newTitle: string;
	newSummary: string;
	newImageUrl: string;
	newContent: string;
	onClose: () => void;
	onChangeTitle: (val: string) => void;
	onChangeSummary: (val: string) => void;
	onChangeImageUrl: (val: string) => void;
	onChangeContent: (val: string) => void;
}

export function NewsFormFields({
	editingId,
	isSubmitting,
	newVisibility,
	newTitle,
	newSummary,
	newImageUrl,
	newContent,
	onClose,
	onChangeTitle,
	onChangeSummary,
	onChangeImageUrl,
	onChangeContent,
}: NewsFormFieldsProps) {
	const { t } = useI18n();
	const maxTitle = Math.min(NEWS_LIMITS.title, newsContract.limits.maxTitleLength);
	const maxSummary = Math.min(NEWS_LIMITS.summary, newsContract.limits.maxSummaryLength);

	return (
		<>
			<div>
				<label style={labelStyle}>{t('newsTitleLabel')}</label>
				<input
					type="text"
					placeholder={t('newsTitlePh')}
					value={newTitle}
					onChange={(e) => onChangeTitle(e.target.value)}
					maxLength={maxTitle}
					required
					style={inputStyle}
				/>
			</div>

			<div>
				<label style={labelStyle}>{t('newsSummaryLabel')}</label>
				<input
					type="text"
					placeholder="..."
					value={newSummary}
					onChange={(e) => onChangeSummary(e.target.value)}
					maxLength={maxSummary}
					style={inputStyle}
				/>
			</div>

			<NewsBannerPicker imageUrl={newImageUrl} onChangeImageUrl={onChangeImageUrl} />

			<div>
				<label style={labelStyle}>{t('newsContentLabel')}</label>
				<textarea
					rows={7}
					placeholder="..."
					value={newContent}
					onChange={(e) => onChangeContent(e.target.value)}
					maxLength={NEWS_LIMITS.content}
					required
					style={{ ...inputStyle, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }}
				/>
			</div>

			<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
				<button
					type="button"
					onClick={onClose}
					style={{
						padding: '8px 16px',
						borderRadius: '8px',
						border: '1px solid rgba(255, 255, 255, 0.2)',
						background: 'transparent',
						color: 'inherit',
						fontSize: '13px',
						cursor: 'pointer',
					}}
				>
					{t('cancel')}
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					style={{
						padding: '8px 22px',
						borderRadius: '8px',
						border: 'none',
						background: 'var(--accent)',
						color: 'var(--accent-contrast, #ffffff)',
						fontSize: '13px',
						fontWeight: 700,
						cursor: 'pointer',
						boxShadow: 'var(--accent-glow)',
					}}
				>
					{isSubmitting
						? editingId
							? t('newsSaving')
							: newVisibility === 'draft'
							? t('newsSaving')
							: t('newsPublishing')
						: editingId
						? t('newsSaveEdit')
						: newVisibility === 'draft'
						? t('newsSaveDraft')
						: t('newsPublish')}
				</button>
			</div>
		</>
	);
}
