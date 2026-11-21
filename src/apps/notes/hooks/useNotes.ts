'use client';

import { useState, useRef, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useAppCommand } from '@/core/commands';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import type { AppleNote } from '../types';
import { canPinAnotherNote, clampNoteBody } from '../utils/notesApi';
import { useNoteExport } from './useNoteExport';
import { DEFAULT_FOLDERS, useNoteFolders } from './useNoteFolders';
import { useNoteSync } from './useNoteSync';

export { DEFAULT_FOLDERS };

export function useNotes() {
	const { t } = useI18n();
	const { isAuthenticated } = useSession();
	const { playSystemSound } = useSound();

	const [notes, setNotes] = useState<AppleNote[]>([]);
	const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);
	const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
	const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
	const [showShareMenu, setShowShareMenu] = useState(false);
	const [copied, setCopied] = useState(false);

	const titleInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const folderState = useNoteFolders({ isAuthenticated, playSystemSound, setNotes });
	const {
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
	} = folderState;

	const untitledLabel = t('notesUntitledNote');
	const { syncStatus, isLoading, syncNoteToServer, scheduleSave } = useNoteSync({
		isAuthenticated,
		defaultFolders,
		untitledLabel,
		setNotes,
		setFolders,
		setSelectedNoteId,
	});

	useFocusTarget('notes', {
		ready: true,
		apply: (target) => { if (target.itemId) setSelectedNoteId(target.itemId); },
	});

	const activeNote = useMemo(() => notes.find((n) => n.id === selectedNoteId) || null, [notes, selectedNoteId]);

	const filteredNotes = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		return notes.filter((n) => {
			if (activeFolderId === 'trash' ? !n.isDeleted : n.isDeleted || (activeFolderId !== 'all' && n.folderId !== activeFolderId)) {
				return false;
			}
			return !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
		});
	}, [notes, activeFolderId, searchQuery]);

	const pinnedNotes = useMemo(
		() => (activeFolderId === 'trash' ? [] : filteredNotes.filter((n) => n.isPinned).sort((a, b) => b.updatedAt - a.updatedAt)),
		[filteredNotes, activeFolderId]
	);

	const regularNotes = useMemo(() => {
		const list = activeFolderId === 'trash' ? filteredNotes : filteredNotes.filter((n) => !n.isPinned);
		return list.sort((a, b) => (a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : b.updatedAt - a.updatedAt));
	}, [filteredNotes, activeFolderId]);

	const handleCreateNote = () => {
		playSystemSound();
		const newFolder = activeFolderId === 'trash' || activeFolderId === 'all' ? 'quick' : activeFolderId;
		const now = Date.now();
		const newNote: AppleNote = {
			id: `not_${now}_${Math.random().toString(36).substring(2, 7)}`,
			title: untitledLabel,
			body: '',
			folderId: newFolder,
			isPinned: false,
			isDeleted: false,
			createdAt: now,
			updatedAt: now,
		};
		setNotes([newNote, ...notes]);
		setSelectedNoteId(newNote.id);
		setEditorMode('edit');
		void syncNoteToServer(newNote);
		setTimeout(() => { titleInputRef.current?.focus(); titleInputRef.current?.select(); }, 50);
	};

	useAppCommand('notes', (command) => { if (command === 'new-note') handleCreateNote(); });

	const handleUpdateTitle = (val: string) => {
		if (!activeNote) return;
		const updatedNote: AppleNote = { ...activeNote, title: val, updatedAt: Date.now() };
		setNotes(notes.map((n) => (n.id === activeNote.id ? updatedNote : n)));
		scheduleSave(updatedNote);
	};

	const handleUpdateBody = (val: string) => {
		if (!activeNote) return;
		const updatedNote: AppleNote = { ...activeNote, body: clampNoteBody(val), updatedAt: Date.now() };
		setNotes(notes.map((n) => (n.id === activeNote.id ? updatedNote : n)));
		scheduleSave(updatedNote);
	};

	const handleTogglePin = (noteId: string) => {
		playSystemSound();
		const target = notes.find((n) => n.id === noteId);
		if (!target || !canPinAnotherNote(notes, target)) return;
		const updatedNote = { ...target, isPinned: !target.isPinned, updatedAt: Date.now() };
		setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
		void syncNoteToServer(updatedNote);
	};

	const handleDeleteNote = async (noteId: string) => {
		playSystemSound();
		if (activeFolderId === 'trash') {
			const updated = notes.filter((n) => n.id !== noteId);
			setNotes(updated);
			if (isAuthenticated) await fetch(`/api/notes?id=${encodeURIComponent(noteId)}`, { method: 'DELETE' }).catch(() => {});
			if (selectedNoteId === noteId) setSelectedNoteId(updated.find((n) => n.isDeleted)?.id || null);
		} else {
			const target = notes.find((n) => n.id === noteId);
			if (!target) return;
			const updatedNote: AppleNote = { ...target, isDeleted: true, updatedAt: Date.now() };
			const updated = notes.map((n) => (n.id === noteId ? updatedNote : n));
			setNotes(updated);
			void syncNoteToServer(updatedNote);
			if (selectedNoteId === noteId) {
				setSelectedNoteId(updated.find((n) => !n.isDeleted && (activeFolderId === 'all' || n.folderId === activeFolderId))?.id || null);
			}
		}
	};

	const handleRestoreNote = (noteId: string) => {
		playSystemSound();
		const target = notes.find((n) => n.id === noteId);
		if (!target) return;
		const updatedNote: AppleNote = { ...target, isDeleted: false, updatedAt: Date.now() };
		setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
		void syncNoteToServer(updatedNote);
	};

	const handleEmptyTrash = async () => {
		playSystemSound();
		setNotes(notes.filter((n) => !n.isDeleted));
		if (isAuthenticated) await fetch('/api/notes?trash=true', { method: 'DELETE' }).catch(() => {});
		if (activeFolderId === 'trash') setSelectedNoteId(null);
	};

	const handleMoveFolder = (noteId: string, folderId: string) => {
		playSystemSound();
		const target = notes.find((n) => n.id === noteId);
		if (!target) return;
		const updatedNote: AppleNote = { ...target, folderId, updatedAt: Date.now() };
		setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
		void syncNoteToServer(updatedNote);
		setFolderSelectMenuOpen(false);
	};

	const exportActions = useNoteExport({
		activeNote, textareaRef, handleUpdateBody, playSystemSound, setCopied, setShowShareMenu,
	});

	return {
		notes, folders, activeFolderId, setActiveFolderId, selectedNoteId, setSelectedNoteId,
		searchQuery, setSearchQuery, isSidebarOpen, setIsSidebarOpen, viewMode, setViewMode,
		editorMode, setEditorMode, syncStatus, isLoading, showNewFolderModal, setShowNewFolderModal,
		newFolderName, setNewFolderName, showShareMenu, setShowShareMenu, copied,
		folderSelectMenuOpen, setFolderSelectMenuOpen, titleInputRef, textareaRef,
		activeNote, filteredNotes, pinnedNotes, regularNotes, handleCreateNote,
		handleUpdateTitle, handleUpdateBody, handleTogglePin, handleDeleteNote,
		handleRestoreNote, handleEmptyTrash, handleMoveFolder, handleCreateFolder,
		handleDeleteCustomFolder, ...exportActions,
	};
}
