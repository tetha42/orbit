'use client';

import React from 'react';
import { Newspaper } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useNews } from './hooks/useNews';
import { NewsToolbar } from './components/NewsToolbar';
import { NewsCard } from './components/NewsCard';
import { NewsDetailModal } from './components/NewsDetailModal';
import { NewsFormModal } from './components/NewsFormModal';

import { UrgentHeadlineBanner } from './components/UrgentHeadlineBanner';
import { useIsMobile } from '@/lib/client/useClientValue';

export function NewsApp() {
	const { t } = useI18n();
	const newsHook = useNews();
	const isMobile = useIsMobile();

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--window-bg)',
				color: 'var(--text-primary)',
				fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
				overflow: 'hidden',
			}}
		>
			<NewsToolbar
				isAdmin={newsHook.isAdmin}
				activeCategory={newsHook.activeCategory}
				onSelectCategory={newsHook.setActiveCategory}
				searchQuery={newsHook.searchQuery}
				onSearchChange={newsHook.setSearchQuery}
				onOpenCreate={newsHook.openCreateForm}
			/>

			<div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '20px' }}>
				{newsHook.activeCategory === 'all' && !newsHook.searchQuery && newsHook.urgentNews && (
					<UrgentHeadlineBanner
						article={newsHook.urgentNews}
						isAdmin={newsHook.isAdmin}
						deletingId={newsHook.deletingId}
						onSelect={newsHook.setSelectedArticle}
						onDelete={newsHook.handleDeleteNews}
					/>
				)}

				{newsHook.filteredNews.length === 0 ? (
					<div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.6 }}>
						<Newspaper size={44} style={{ margin: '0 auto 14px auto', opacity: 0.4 }} />
						<div style={{ fontSize: '16px', fontWeight: 700 }}>{t('newsEmpty')}</div>
						<div style={{ fontSize: '12.5px', marginTop: '6px', opacity: 0.7 }}>
							{newsHook.isAdmin ? t('newsEmptyAdmin') : t('newsEmptyUser')}
						</div>
					</div>
				) : (
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
							gap: isMobile ? '12px' : '18px',
						}}
					>
						{newsHook.filteredNews.map((article) => (
							<NewsCard
								key={article.id}
								article={article}
								isAdmin={newsHook.isAdmin}
								deletingId={newsHook.deletingId}
								onSelect={() => newsHook.setSelectedArticle(article)}
								onEdit={(e) => newsHook.openEditForm(article, e)}
								onDelete={(e) => newsHook.handleDeleteNews(article.id, e)}
							/>
						))}
					</div>
				)}
			</div>

			{newsHook.selectedArticle && (
				<NewsDetailModal
					article={newsHook.selectedArticle}
					isAdmin={newsHook.isAdmin}
					copied={newsHook.copied}
					onClose={() => newsHook.setSelectedArticle(null)}
					onEdit={() => {
						const article = newsHook.selectedArticle!;
						newsHook.setSelectedArticle(null);
						newsHook.openEditForm(article);
					}}
					onDelete={() => newsHook.handleDeleteNews(newsHook.selectedArticle!.id)}
					onShare={() => newsHook.handleShare(newsHook.selectedArticle!)}
					onChangeVisibility={(v) => newsHook.changeVisibility(newsHook.selectedArticle!, v)}
				/>
			)}

			{newsHook.isCreateModalOpen && (
				<NewsFormModal
					editingId={newsHook.editingId}
					formError={newsHook.formError}
					isSubmitting={newsHook.isSubmitting}
					newVisibility={newsHook.newVisibility}
					newCategory={newsHook.newCategory}
					newOnemliMi={newsHook.newOnemliMi}
					newTitle={newsHook.newTitle}
					newSummary={newsHook.newSummary}
					newResimUrl={newsHook.newResimUrl}
					newContent={newsHook.newContent}
					onClose={() => newsHook.setIsCreateModalOpen(false)}
					onSubmit={newsHook.handleSaveNews}
					onChangeVisibility={newsHook.setNewVisibility}
					onChangeCategory={newsHook.setNewCategory}
					onChangeOnemliMi={newsHook.setNewOnemliMi}
					onChangeTitle={newsHook.setNewTitle}
					onChangeSummary={newsHook.setNewSummary}
					onChangeResimUrl={newsHook.setNewResimUrl}
					onChangeContent={newsHook.setNewContent}
				/>
			)}
		</div>
	);
}

export default NewsApp;
