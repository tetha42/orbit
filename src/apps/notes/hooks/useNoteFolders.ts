'use client';

import { useState, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import type { AppleNote, NoteFolder } from '../types';

export const DEFAULT_FOLDERS: NoteFolder[] = [
	{ id: 'all', name: 'All Notes', isSystem: true, iconType: 'all' },
	{ id: 'quick', name: 'Quick Notes', isSystem: true, iconType: 'quick' },
	{ id: 'club', name: 'Community & Management', isSystem: true, iconType: 'club' },
	{ id: 'teknofest', name: 'Teknofest & R&D', isSystem: true, iconType: 'teknofest' },
	{ id: 'workshops', name: 'Workshops & Training', isSystem: true, iconType: 'workshops' },
	{ id: 'personal', name: 'Personal', isSystem: true, iconType: 'personal' },
];

export function useNoteFolders({
	isAuthenticated,
	playSystemSound,
	setNotes,
}: {
	isAuthenticated: boolean;
	playSystemSound: () => void;
	setNotes: React.Dispatch<React.SetStateAction<AppleNote[]>>;
}) {
	const { t } = useI18n();

	const defaultFolders: NoteFolder[] = useMemo(() => [
		{ id: 'all', name: t('notesFolderAll'), isSystem: true, iconType: 'all' },
		{ id: 'quick', name: t('notesFolderQuick'), isSystem: true, iconType: 'quick' },
		{ id: 'club', name: t('notesFolderClub'), isSystem: true, iconType: 'club' },
		{ id: 'teknofest', name: t('notesFolderTeknofest'), isSystem: true, iconType: 'teknofest' },
		{ id: 'workshops', name: t('notesFolderWorkshops'), isSystem: true, iconType: 'workshops' },
		{ id: 'personal', name: t('notesFolderPersonal'), isSystem: true, iconType: 'personal' },
	], [t]);

	const [folders, setFolders] = useState<NoteFolder[]>(defaultFolders);
	const [activeFolderId, setActiveFolderId] = useState('all');
	const [showNewFolderModal, setShowNewFolderModal] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const [folderSelectMenuOpen, setFolderSelectMenuOpen] = useState(false);

	const handleCreateFolder = async () => {
		if (!newFolderName.trim()) return;
		playSystemSound();
		const folderId = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
		const folderName = newFolderName.trim();
		setFolders((prev) => [...prev, { id: folderId, name: folderName, isSystem: false, iconType: 'custom' }]);
		setActiveFolderId(folderId);
		setNewFolderName('');
		setShowNewFolderModal(false);
		if (isAuthenticated) {
			await fetch('/api/notes/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: folderId, name: folderName }),
			}).catch(() => {});
		}
	};

	const handleDeleteCustomFolder = async (folderId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		playSystemSound();
		setFolders((prev) => prev.filter((f) => f.id !== folderId));
		setNotes((prev) => prev.map((n) => (n.folderId === folderId ? { ...n, folderId: 'quick' } : n)));
		if (activeFolderId === folderId) setActiveFolderId('all');
		if (isAuthenticated) {
			await fetch(`/api/notes/folders?id=${encodeURIComponent(folderId)}`, { method: 'DELETE' }).catch(() => {});
		}
	};

	return {
		defaultFolders,
		folders,
		setFolders,
		activeFolderId,
		setActiveFolderId,
		showNewFolderModal,
		setShowNewFolderModal,
		newFolderName,
		setNewFolderName,
		folderSelectMenuOpen,
		setFolderSelectMenuOpen,
		handleCreateFolder,
		handleDeleteCustomFolder,
	};
}
