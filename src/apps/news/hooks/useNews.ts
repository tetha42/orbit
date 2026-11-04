'use client';

import { useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useJsonResource } from '@/core/data/useJsonResource';
import type { NewsVisibility } from '@/types/news';
import type { NewsEntry } from '../types';

export function useNews() {
	const { canManageApp } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const isAdmin = canManageApp('news');

	const { data: newsData, refetch: fetchNews } = useJsonResource<NewsEntry[]>('/api/news');
	const news = newsData ?? [];

	const [activeCategory, setActiveCategory] = useState<string>('all');
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [selectedArticle, setSelectedArticle] = useState<NewsEntry | null>(null);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	useFocusTarget('news', {
		ready: newsData !== null,
		apply: (target) => {
			setActiveCategory('all');
			setSearchQuery('');
			const found = news.find((item) => item.id === target.itemId);
			if (found) setSelectedArticle(found);
		},
		refetch: fetchNews,
	});

	const [newTitle, setNewTitle] = useState('');
	const [newSummary, setNewSummary] = useState('');
	const [newContent, setNewContent] = useState('');
	const [newCategory, setNewCategory] = useState('genel');
	const [newImportantMi, setNewImportantMi] = useState(false);
	const [newImageUrl, setNewImageUrl] = useState('');
	const [newVisibility, setNewVisibility] = useState<NewsVisibility>('yayinda');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const openCreateForm = () => {
		setEditingId(null);
		setNewTitle('');
		setNewSummary('');
		setNewContent('');
		setNewCategory('genel');
		setNewImportantMi(false);
		setNewImageUrl('');
		setNewVisibility('yayinda');
		setFormError(null);
		setIsCreateModalOpen(true);
	};

	const openEditForm = (article: NewsEntry, e?: React.MouseEvent) => {
		if (e) e.stopPropagation();
		setEditingId(article.id);
		setNewTitle(article.title);
		setNewSummary(article.summary === article.title ? '' : article.summary);
		setNewContent(article.content);
		setNewCategory(article.category);
		setNewImportantMi(article.importantMi === 1);
		setNewImageUrl(article.imageUrl ?? '');
		setNewVisibility(article.publishStatus);
		setFormError(null);
		setIsCreateModalOpen(true);
	};

	const handleSaveNews = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTitle.trim() || !newContent.trim()) {
			setFormError(t('newsFormMissingFields'));
			return;
		}

		try {
			setIsSubmitting(true);
			setFormError(null);
			const res = await fetch('/api/news', {
				method: editingId ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(editingId ? { id: editingId } : {}),
					title: newTitle.trim(),
					summary: (newSummary || newTitle).trim(),
					content: newContent.trim(),
					category: newCategory,
					importantMi: newImportantMi,
					imageUrl: newImageUrl.trim(),
					publishStatus: newVisibility,
				}),
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				setFormError(errData.error || (editingId ? t('newsFormSaveFailed') : t('newsFormPublishFailed')));
				return;
			}

			const saved: NewsEntry = await res.json();
			playSystemSound();
			setIsCreateModalOpen(false);
			setEditingId(null);
			await fetchNews();
			setSelectedArticle(saved);
		} catch (error) {
			console.error('Error saving news:', error);
			setFormError(t('newsFormNetworkError'));
		} finally {
			setIsSubmitting(false);
		}
	};

	const changeVisibility = async (article: NewsEntry, publishStatus: NewsVisibility) => {
		if (publishStatus === article.publishStatus) return;
		try {
			const res = await fetch('/api/news', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: article.id, publishStatus }),
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				void dialog.alert({ message: errData.error || t('newsVisibilityError'), tone: 'danger' });
				return;
			}
			const saved: NewsEntry = await res.json();
			playSystemSound();
			await fetchNews();
			if (selectedArticle?.id === article.id) setSelectedArticle(saved);
		} catch (error) {
			console.error('Error changing visibility:', error);
			void dialog.alert({ message: t('newsVisibilityNetworkError'), tone: 'danger' });
		}
	};

	const handleDeleteNews = async (id: string, e?: React.MouseEvent) => {
		if (e) e.stopPropagation();
		const confirmed = await dialog.confirm({
			message: t('newsDeleteConfirm'),
			tone: 'danger',
		});
		if (!confirmed) return;

		try {
			setDeletingId(id);
			const res = await fetch(`/api/news?id=${encodeURIComponent(id)}`, {
				method: 'DELETE',
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				void dialog.alert({ message: errData.error || t('newsDeleted'), tone: 'danger' });
				return;
			}

			playSystemSound();
			if (selectedArticle?.id === id) {
				setSelectedArticle(null);
			}
			await fetchNews();
		} catch (error) {
			console.error('Error deleting news:', error);
			void dialog.alert({ message: 'Error deleting news.', tone: 'danger' });
		} finally {
			setDeletingId(null);
		}
	};

	const handleShare = (article: NewsEntry) => {
		const text = `${article.title}\n\n${article.summary}\n\n${t('newsShareClubSuffix')}`;
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const filteredNews = news.filter((n) => {
		if (activeCategory !== 'all' && n.category !== activeCategory) {
			return false;
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			return (
				n.title.toLowerCase().includes(q) ||
				n.summary.toLowerCase().includes(q) ||
				n.content.toLowerCase().includes(q)
			);
		}
		return true;
	});

	const urgentNews = news.find((n) => n.importantMi === 1 && n.publishStatus !== 'taslak');

	return {
		isAdmin,
		news,
		filteredNews,
		urgentNews,
		activeCategory,
		setActiveCategory,
		searchQuery,
		setSearchQuery,
		selectedArticle,
		setSelectedArticle,
		isCreateModalOpen,
		setIsCreateModalOpen,
		copied,
		newTitle,
		setNewTitle,
		newSummary,
		setNewSummary,
		newContent,
		setNewContent,
		newCategory,
		setNewCategory,
		newImportantMi,
		setNewImportantMi,
		newImageUrl,
		setNewImageUrl,
		newVisibility,
		setNewVisibility,
		editingId,
		formError,
		isSubmitting,
		deletingId,
		openCreateForm,
		openEditForm,
		handleSaveNews,
		changeVisibility,
		handleDeleteNews,
		handleShare,
	};
}
