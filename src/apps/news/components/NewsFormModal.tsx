'use client';

import React from 'react';
import {
	X,
	AlertTriangle,
	ShieldAlert,
	FilePen,
	Lock,
	Globe,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import { NEWS_LIMITS, NEWS_VISIBILITIES, type NewsVisibility } from '@/types/news';

interface NewsFormModalProps {
	editingId: string | null;
	formError: string | null;
	isSubmitting: boolean;
	newVisibility: NewsVisibility;
	newCategory: string;
	newOnemliMi: boolean;
	newTitle: string;
	newSummary: string;
	newResimUrl: string;
	newContent: string;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
	onChangeVisibility: (v: NewsVisibility) => void;
	onChangeCategory: (c: string) => void;
	onChangeOnemliMi: (val: boolean) => void;
	onChangeTitle: (val: string) => void;
	onChangeSummary: (val: string) => void;
	onChangeResimUrl: (val: string) => void;
	onChangeContent: (val: string) => void;
}

export function NewsFormModal({
	editingId,
	formError,
	isSubmitting,
	newVisibility,
	newCategory,
	newOnemliMi,
	newTitle,
	newSummary,
	newResimUrl,
	newContent,
	onClose,
	onSubmit,
	onChangeVisibility,
	onChangeCategory,
	onChangeOnemliMi,
	onChangeTitle,
	onChangeSummary,
	onChangeResimUrl,
	onChangeContent,
}: NewsFormModalProps) {
	const { t } = useI18n();
	const { offset, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(true);

	const visibilityBadges: Record<
		NewsVisibility,
		{ color: string; icon: React.ComponentType<{ size?: number; color?: string }>; hint: string; label: string }
	> = {
		taslak: { color: '#8e8e93', icon: FilePen, hint: t('newsVisDraftHint'), label: t('newsVisDraft') },
		uyeler: { color: '#0a84ff', icon: Lock, hint: t('newsVisMembersHint'), label: t('newsVisMembers') },
		yayinda: { color: '#30d158', icon: Globe, hint: t('newsVisPublicHint'), label: t('newsVisPublic') },
	};

	const bannerPresets = [
		{ label: 'TEKNOFEST', url: '/app-icons/vscode/256.png' },
		{ label: t('newsSourceRectorate'), url: '/app-icons/appstore/256.png' },
		{ label: t('newsCatAtolyeShort'), url: '/app-icons/calendar/256.png' },
		{ label: 'Ar-Ge / Envanter', url: '/app-icons/settings/256.png' },
	];

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
					style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', userSelect: 'none' }}
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
									background: 'rgba(255, 45, 85, 0.2)',
									color: '#ff2d55',
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
						style={{
							background: 'transparent',
							border: 'none',
							color: 'inherit',
							cursor: 'pointer',
							opacity: 0.6,
						}}
					>
						<X size={18} />
					</button>
				</div>

				{formError && (
					<div
						style={{
							padding: '10px 14px',
							borderRadius: '8px',
							background: 'rgba(255, 69, 58, 0.15)',
							border: '1px solid rgba(255, 69, 58, 0.3)',
							color: '#ff453a',
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

				<div>
					<label
						htmlFor="news-visibility"
						style={{
							display: 'block',
							fontSize: '11.5px',
							fontWeight: 600,
							marginBottom: '6px',
							opacity: 0.8,
						}}
					>
						{t('newsWhoCanSee')}
					</label>
					<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" id="news-visibility" aria-label={t('newsWhoCanSee')}>
						{NEWS_VISIBILITIES.map((value) => {
							const badge = visibilityBadges[value];
							const Icon = badge.icon;
							const active = newVisibility === value;
							return (
								<button
									key={value}
									type="button"
									role="radio"
									aria-checked={active}
									onClick={() => onChangeVisibility(value)}
									style={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: '6px',
										padding: '7px 12px',
										borderRadius: '8px',
										border: active ? `1px solid ${badge.color}` : '1px solid rgba(255, 255, 255, 0.12)',
										background: active ? `${badge.color}26` : 'rgba(255, 255, 255, 0.04)',
										color: active ? badge.color : 'inherit',
										fontSize: '12.5px',
										fontWeight: active ? 700 : 500,
										cursor: 'pointer',
									}}
								>
									<Icon size={13} />
									{badge.label}
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
					<div>
						<label
							style={{
								fontSize: '11.5px',
								fontWeight: 600,
								opacity: 0.8,
								display: 'block',
								marginBottom: '4px',
							}}
						>
							{t('newsCategoryLabel')}
						</label>
						<select
							value={newCategory}
							onChange={(e) => onChangeCategory(e.target.value)}
							style={{
								width: '100%',
								padding: '9px 12px',
								borderRadius: '8px',
								background: 'rgba(0, 0, 0, 0.3)',
								border: '1px solid rgba(255, 255, 255, 0.15)',
								color: 'inherit',
								fontSize: '13px',
							}}
						>
							<option value="genel">{t('newsCatGenel')}</option>
							<option value="teknofest">{t('newsCatTeknofest')}</option>
							<option value="atolye">{t('newsCatAtolye')}</option>
							<option value="isbirligi">{t('newsCatIsbirligi')}</option>
							<option value="resmi">{t('newsCatResmi')}</option>
						</select>
					</div>

					<div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
						<label
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								fontSize: '12.5px',
								fontWeight: 600,
								cursor: 'pointer',
								color: newOnemliMi ? '#ff375f' : 'inherit',
							}}
						>
							<input
								type="checkbox"
								checked={newOnemliMi}
								onChange={(e) => onChangeOnemliMi(e.target.checked)}
								style={{ width: '16px', height: '16px' }}
							/>
							<span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
								<ShieldAlert size={14} /> {t('newsPinUrgent')}
							</span>
						</label>
					</div>
				</div>

				<div>
					<label
						style={{
							fontSize: '11.5px',
							fontWeight: 600,
							opacity: 0.8,
							display: 'block',
							marginBottom: '4px',
						}}
					>
						{t('newsTitleLabel')}
					</label>
					<input
						type="text"
						placeholder={t('newsTitlePh')}
						value={newTitle}
						onChange={(e) => onChangeTitle(e.target.value)}
						maxLength={NEWS_LIMITS.baslik}
						required
						style={{
							width: '100%',
							padding: '9px 12px',
							borderRadius: '8px',
							background: 'rgba(0, 0, 0, 0.3)',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							color: 'inherit',
							fontSize: '13px',
						}}
					/>
				</div>

				<div>
					<label
						style={{
							fontSize: '11.5px',
							fontWeight: 600,
							opacity: 0.8,
							display: 'block',
							marginBottom: '4px',
						}}
					>
						{t('newsSummaryLabel')}
					</label>
					<input
						type="text"
						placeholder="..."
						value={newSummary}
						onChange={(e) => onChangeSummary(e.target.value)}
						maxLength={NEWS_LIMITS.ozet}
						style={{
							width: '100%',
							padding: '9px 12px',
							borderRadius: '8px',
							background: 'rgba(0, 0, 0, 0.3)',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							color: 'inherit',
							fontSize: '13px',
						}}
					/>
				</div>

				<div>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: '4px',
						}}
					>
						<label style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.8 }}>
							{t('newsBannerLabel')}
						</label>
						<span style={{ fontSize: '11px', opacity: 0.6 }}>{t('newsBannerHint')}</span>
					</div>

					<div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
						{bannerPresets.map((preset) => (
							<button
								key={preset.url}
								type="button"
								onClick={() => onChangeResimUrl(preset.url)}
								style={{
									padding: '4px 10px',
									borderRadius: '6px',
									border:
										newResimUrl === preset.url
											? '1px solid #0a84ff'
											: '1px solid rgba(255, 255, 255, 0.1)',
									background:
										newResimUrl === preset.url
											? 'rgba(10, 132, 255, 0.2)'
											: 'rgba(255, 255, 255, 0.05)',
									color: newResimUrl === preset.url ? '#0a84ff' : 'inherit',
									fontSize: '11px',
									cursor: 'pointer',
								}}
							>
								{preset.label}
							</button>
						))}
					</div>

					<input
						type="text"
						placeholder={t('newsIconUrlPh')}
						value={newResimUrl}
						onChange={(e) => onChangeResimUrl(e.target.value)}
						style={{
							width: '100%',
							padding: '8px 12px',
							borderRadius: '8px',
							background: 'rgba(0, 0, 0, 0.3)',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							color: 'inherit',
							fontSize: '12.5px',
						}}
					/>
				</div>

				<div>
					<label
						style={{
							fontSize: '11.5px',
							fontWeight: 600,
							opacity: 0.8,
							display: 'block',
							marginBottom: '4px',
						}}
					>
						{t('newsContentLabel')}
					</label>
					<textarea
						rows={7}
						placeholder="..."
						value={newContent}
						onChange={(e) => onChangeContent(e.target.value)}
						maxLength={NEWS_LIMITS.icerik}
						required
						style={{
							width: '100%',
							padding: '10px 12px',
							borderRadius: '8px',
							background: 'rgba(0, 0, 0, 0.3)',
							border: '1px solid rgba(255, 255, 255, 0.15)',
							color: 'inherit',
							fontSize: '13px',
							resize: 'vertical',
							lineHeight: 1.5,
						}}
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
							? (editingId ? t('newsSaving') : newVisibility === 'taslak' ? t('newsSaving') : t('newsPublishing'))
							: (editingId ? t('newsSaveEdit') : newVisibility === 'taslak' ? t('newsSaveDraft') : t('newsPublish'))}
					</button>
				</div>
			</form>
		</ModalOverlay>
	);
}
