'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useAppCommand } from '@/core/commands';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import type { AppleNote, NoteFolder, ServerNoteRecord } from '../types';

export const DEFAULT_FOLDERS: NoteFolder[] = [
	{ id: 'all', name: 'All Notes', isSystem: true, iconType: 'all' },
	{ id: 'quick', name: 'Quick Notes', isSystem: true, iconType: 'quick' },
	{ id: 'club', name: 'Club & Management', isSystem: true, iconType: 'club' },
	{ id: 'teknofest', name: 'Teknofest & R&D', isSystem: true, iconType: 'teknofest' },
	{ id: 'workshops', name: 'Workshops & Training', isSystem: true, iconType: 'workshops' },
	{ id: 'personal', name: 'Personal', isSystem: true, iconType: 'personal' },
];

function generateNewNoteId(): string {
	return `not_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function useNotes() {
	const { t } = useI18n();
	const { isAuthenticated } = useSession();
	const { playSystemSound } = useSound();

	const defaultFolders: NoteFolder[] = useMemo(() => [
		{ id: 'all', name: t('notesFolderAll'), isSystem: true, iconType: 'all' },
		{ id: 'quick', name: t('notesFolderQuick'), isSystem: true, iconType: 'quick' },
		{ id: 'club', name: t('notesFolderClub'), isSystem: true, iconType: 'club' },
		{ id: 'teknofest', name: t('notesFolderTeknofest'), isSystem: true, iconType: 'teknofest' },
		{ id: 'workshops', name: t('notesFolderWorkshops'), isSystem: true, iconType: 'workshops' },
		{ id: 'personal', name: t('notesFolderPersonal'), isSystem: true, iconType: 'personal' },
	], [t]);

	const [notes, setNotes] = useState<AppleNote[]>([]);
	const [folders, setFolders] = useState<NoteFolder[]>(defaultFolders);
	const [activeFolderId, setActiveFolderId] = useState<string>('all');
	const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
	const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
	const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
	const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
	const [isLoading, setIsLoading] = useState<boolean>(true);

	const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
	const [newFolderName, setNewFolderName] = useState<string>('');
	const [showShareMenu, setShowShareMenu] = useState<boolean>(false);
	const [copied, setCopied] = useState<boolean>(false);
	const [folderSelectMenuOpen, setFolderSelectMenuOpen] = useState<boolean>(false);

	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const titleInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useFocusTarget('notes', {
		ready: true,
		apply: (target) => {
			if (target.itemId) {
				setSelectedNoteId(target.itemId);
			}
		},
	});

	useEffect(() => {
		let isMounted = true;
		const loadData = async () => {
			setIsLoading(true);
			let loadedNotes: AppleNote[] = [];
			let loadedCustomFolders: NoteFolder[] = [];

			if (isAuthenticated) {
				try {
					const [notesRes, foldersRes] = await Promise.all([
						fetch('/api/notes'),
						fetch('/api/notes/folders'),
					]);

					if (notesRes.ok) {
						const serverNotes = await notesRes.json();
						if (Array.isArray(serverNotes)) {
							loadedNotes = serverNotes.map((sn: ServerNoteRecord) => {
								let parsedBody = sn.icerik || '';
								let folderId = sn.klasorId || sn.renk || 'quick';
								let isDeleted = Boolean(sn.copteMi);

								if (typeof sn.icerik === 'string' && sn.icerik.startsWith('{') && sn.icerik.includes('"body"')) {
									try {
										const obj = JSON.parse(sn.icerik);
										if (obj.body !== undefined) parsedBody = obj.body;
										if (obj.folderId) folderId = obj.folderId;
										if (obj.isDeleted !== undefined) isDeleted = Boolean(obj.isDeleted);
									} catch {
										// Plain text
									}
								}

								return {
									id: sn.id,
									title: sn.baslik || t('notesUntitledNote'),
									body: parsedBody,
									folderId,
									isPinned: Boolean(sn.sabitliMi),
									isDeleted,
									createdAt: Number(sn.olusturma) || Date.now(),
									updatedAt: Number(sn.guncellenme) || Date.now(),
								};
							});
						}
					}

					if (foldersRes.ok) {
						const serverFolders = await foldersRes.json();
						if (Array.isArray(serverFolders)) {
							loadedCustomFolders = serverFolders.map((sf: { id: string; ad: string }) => ({
								id: sf.id,
								name: sf.ad,
								isSystem: false,
								iconType: 'custom',
							}));
						}
					}
				} catch (e) {
					console.error('Failed to load notes from DB:', e);
				}
			}

			if (!isMounted) return;

			setNotes(loadedNotes);
			setFolders([...defaultFolders, ...loadedCustomFolders]);
			setIsLoading(false);

			const firstActive = loadedNotes.find((n) => !n.isDeleted);
			if (firstActive) {
				setSelectedNoteId(firstActive.id);
			} else {
				setSelectedNoteId(null);
			}
		};

		loadData();
		return () => {
			isMounted = false;
		};
	}, [isAuthenticated, defaultFolders, t]);

	const syncNoteToServer = async (note: AppleNote) => {
		if (!isAuthenticated) {
			setSyncStatus('offline');
			return;
		}

		try {
			setSyncStatus('saving');
			const payload = {
				id: note.id,
				baslik: note.title.trim() || t('notesUntitledNote'),
				icerik: note.body,
				klasorId: note.folderId,
				renk: note.folderId,
				sabitliMi: note.isPinned,
				copteMi: Boolean(note.isDeleted),
			};

			const res = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (res.ok) {
				setSyncStatus('saved');
			} else {
				setSyncStatus('offline');
			}
		} catch {
			setSyncStatus('offline');
		}
	};

	const scheduleSave = (note: AppleNote) => {
		setSyncStatus('saving');
		if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		saveTimeoutRef.current = setTimeout(() => {
			syncNoteToServer(note);
		}, 400);
	};

	const activeNote = useMemo(() => {
		return notes.find((n) => n.id === selectedNoteId) || null;
	}, [notes, selectedNoteId]);

	const filteredNotes = useMemo(() => {
		return notes.filter((n) => {
			if (activeFolderId === 'trash') {
				if (!n.isDeleted) return false;
			} else {
				if (n.isDeleted) return false;
				if (activeFolderId !== 'all' && n.folderId !== activeFolderId) {
					return false;
				}
			}

			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				const matchTitle = n.title.toLowerCase().includes(query);
				const matchBody = n.body.toLowerCase().includes(query);
				return matchTitle || matchBody;
			}

			return true;
		});
	}, [notes, activeFolderId, searchQuery]);

	const pinnedNotes = useMemo(() => {
		if (activeFolderId === 'trash') return [];
		return filteredNotes.filter((n) => n.isPinned).sort((a, b) => b.updatedAt - a.updatedAt);
	}, [filteredNotes, activeFolderId]);

	const regularNotes = useMemo(() => {
		const list = activeFolderId === 'trash' ? filteredNotes : filteredNotes.filter((n) => !n.isPinned);
		return list.sort((a, b) => {
			if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
			return b.updatedAt - a.updatedAt;
		});
	}, [filteredNotes, activeFolderId]);

	const handleCreateNote = () => {
		playSystemSound();
		const newFolder = activeFolderId === 'trash' || activeFolderId === 'all' ? 'quick' : activeFolderId;
		const now = Date.now();
		const newNote: AppleNote = {
			id: generateNewNoteId(),
			title: 'Yeni Not',
			body: '',
			folderId: newFolder,
			isPinned: false,
			isDeleted: false,
			createdAt: now,
			updatedAt: now,
		};

		const updated = [newNote, ...notes];
		setNotes(updated);
		setSelectedNoteId(newNote.id);
		setEditorMode('edit');
		syncNoteToServer(newNote);

		setTimeout(() => {
			titleInputRef.current?.focus();
			titleInputRef.current?.select();
		}, 50);
	};

	useAppCommand('notes', (command) => {
		if (command === 'new-note') handleCreateNote();
	});

	const handleUpdateTitle = (val: string) => {
		if (!activeNote) return;
		const updatedNote: AppleNote = {
			...activeNote,
			title: val,
			updatedAt: Date.now(),
		};
		const updatedList = notes.map((n) => (n.id === activeNote.id ? updatedNote : n));
		setNotes(updatedList);
		scheduleSave(updatedNote);
	};

	const handleUpdateBody = (val: string) => {
		if (!activeNote) return;
		const updatedNote: AppleNote = {
			...activeNote,
			body: val,
			updatedAt: Date.now(),
		};
		const updatedList = notes.map((n) => (n.id === activeNote.id ? updatedNote : n));
		setNotes(updatedList);
		scheduleSave(updatedNote);
	};

	const handleTogglePin = (noteId: string) => {
		playSystemSound();
		const target = notes.find((n) => n.id === noteId);
		if (!target) return;
		const updatedNote = { ...target, isPinned: !target.isPinned, updatedAt: Date.now() };
		const updated = notes.map((n) => (n.id === noteId ? updatedNote : n));
		setNotes(updated);
		syncNoteToServer(updatedNote);
	};

	const handleDeleteNote = async (noteId: string) => {
		playSystemSound();
		if (activeFolderId === 'trash') {
			const updated = notes.filter((n) => n.id !== noteId);
			setNotes(updated);
			if (isAuthenticated) {
				try {
					await fetch(`/api/notes?id=${encodeURIComponent(noteId)}`, { method: 'DELETE' });
				} catch (e) {
					console.error('Failed to permanently delete note:', e);
				}
			}
			if (selectedNoteId === noteId) {
				setSelectedNoteId(updated.find((n) => n.isDeleted)?.id || null);
			}
		} else {
			const target = notes.find((n) => n.id === noteId);
			if (!target) return;
			const updatedNote: AppleNote = { ...target, isDeleted: true, updatedAt: Date.now() };
			const updated = notes.map((n) => (n.id === noteId ? updatedNote : n));
			setNotes(updated);
			syncNoteToServer(updatedNote);
			if (selectedNoteId === noteId) {
				const next = updated.find((n) => !n.isDeleted && (activeFolderId === 'all' || n.folderId === activeFolderId));
				setSelectedNoteId(next?.id || null);
			}
		}
	};

	const handleRestoreNote = (noteId: string) => {
		playSystemSound();
		const target = notes.find((n) => n.id === noteId);
		if (!target) return;
		const updatedNote: AppleNote = { ...target, isDeleted: false, updatedAt: Date.now() };
		const updated = notes.map((n) => (n.id === noteId ? updatedNote : n));
		setNotes(updated);
		syncNoteToServer(updatedNote);
	};

	const handleEmptyTrash = async () => {
		playSystemSound();
		const updated = notes.filter((n) => !n.isDeleted);
		setNotes(updated);
		if (isAuthenticated) {
			try {
				await fetch('/api/notes?trash=true', { method: 'DELETE' });
			} catch (e) {
				console.error('Failed to empty trash on server:', e);
			}
		}
		if (activeFolderId === 'trash') {
			setSelectedNoteId(null);
		}
	};

	const handleMoveFolder = (noteId: string, folderId: string) => {
		playSystemSound();
		const target = notes.find((n) => n.id === noteId);
		if (!target) return;
		const updatedNote: AppleNote = { ...target, folderId, updatedAt: Date.now() };
		const updated = notes.map((n) => (n.id === noteId ? updatedNote : n));
		setNotes(updated);
		syncNoteToServer(updatedNote);
		setFolderSelectMenuOpen(false);
	};

	const handleCreateFolder = async () => {
		if (!newFolderName.trim()) return;
		playSystemSound();
		const folderId = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
		const folderName = newFolderName.trim();
		const newFld: NoteFolder = {
			id: folderId,
			name: folderName,
			isSystem: false,
			iconType: 'custom',
		};
		const updatedFolders = [...folders, newFld];
		setFolders(updatedFolders);
		setActiveFolderId(folderId);
		setNewFolderName('');
		setShowNewFolderModal(false);

		if (isAuthenticated) {
			try {
				await fetch('/api/notes/folders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: folderId, ad: folderName }),
				});
			} catch (e) {
				console.error('Failed to save folder to server:', e);
			}
		}
	};

	const handleDeleteCustomFolder = async (folderId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		playSystemSound();
		const updatedFolders = folders.filter((f) => f.id !== folderId);
		setFolders(updatedFolders);
		const updatedNotes = notes.map((n) => (n.folderId === folderId ? { ...n, folderId: 'quick' } : n));
		setNotes(updatedNotes);
		if (activeFolderId === folderId) {
			setActiveFolderId('all');
		}

		if (isAuthenticated) {
			try {
				await fetch(`/api/notes/folders?id=${encodeURIComponent(folderId)}`, { method: 'DELETE' });
			} catch (e) {
				console.error('Failed to delete folder on server:', e);
			}
		}
	};

	const insertTextAtCursor = (prefix: string, suffix: string = '') => {
		if (!textareaRef.current || !activeNote) return;
		playSystemSound();
		const textarea = textareaRef.current;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selected = text.substring(start, end);
		const replacement = prefix + selected + suffix;

		const nextValue = text.substring(0, start) + replacement + text.substring(end);
		handleUpdateBody(nextValue);

		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + prefix.length, end + prefix.length);
		}, 10);
	};

	const handleToggleChecklistItem = (lineIndex: number) => {
		if (!activeNote) return;
		playSystemSound();
		const lines = activeNote.body.split('\n');
		const line = lines[lineIndex];
		if (!line) return;

		if (line.includes('- [ ]')) {
			lines[lineIndex] = line.replace('- [ ]', '- [x]');
		} else if (line.includes('- [x]')) {
			lines[lineIndex] = line.replace('- [x]', '- [ ]');
		}

		handleUpdateBody(lines.join('\n'));
	};

	const handleCopyText = async () => {
		if (!activeNote) return;
		try {
			const fullText = `${activeNote.title}\n\n${activeNote.body}`;
			await navigator.clipboard.writeText(fullText);
			setCopied(true);
			playSystemSound();
			setTimeout(() => setCopied(false), 2000);
			setShowShareMenu(false);
		} catch {}
	};

	const handleDownloadMarkdown = () => {
		if (!activeNote) return;
		playSystemSound();
		const fullText = `# ${activeNote.title}\n\n${activeNote.body}`;
		const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${activeNote.title.replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_')}.md`;
		a.click();
		URL.revokeObjectURL(url);
		setShowShareMenu(false);
	};

	const handlePrint = () => {
		playSystemSound();
		setShowShareMenu(false);
		window.print();
	};

	return {
		notes,
		folders,
		activeFolderId,
		setActiveFolderId,
		selectedNoteId,
		setSelectedNoteId,
		searchQuery,
		setSearchQuery,
		isSidebarOpen,
		setIsSidebarOpen,
		viewMode,
		setViewMode,
		editorMode,
		setEditorMode,
		syncStatus,
		isLoading,
		showNewFolderModal,
		setShowNewFolderModal,
		newFolderName,
		setNewFolderName,
		showShareMenu,
		setShowShareMenu,
		copied,
		folderSelectMenuOpen,
		setFolderSelectMenuOpen,
		titleInputRef,
		textareaRef,
		activeNote,
		filteredNotes,
		pinnedNotes,
		regularNotes,
		handleCreateNote,
		handleUpdateTitle,
		handleUpdateBody,
		handleTogglePin,
		handleDeleteNote,
		handleRestoreNote,
		handleEmptyTrash,
		handleMoveFolder,
		handleCreateFolder,
		handleDeleteCustomFolder,
		insertTextAtCursor,
		handleToggleChecklistItem,
		handleCopyText,
		handleDownloadMarkdown,
		handlePrint,
	};
}
