'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AppleNote, NoteFolder } from '../types';
import { fetchNotesAndFolders, saveNoteToServer } from '../utils/notesApi';

export function useNoteSync({
	isAuthenticated,
	defaultFolders,
	untitledLabel,
	setNotes,
	setFolders,
	setSelectedNoteId,
}: {
	isAuthenticated: boolean;
	defaultFolders: NoteFolder[];
	untitledLabel: string;
	setNotes: React.Dispatch<React.SetStateAction<AppleNote[]>>;
	setFolders: React.Dispatch<React.SetStateAction<NoteFolder[]>>;
	setSelectedNoteId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
	const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
	const [isLoading, setIsLoading] = useState(true);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		let isMounted = true;
		const loadData = async () => {
			setIsLoading(true);
			let loadedNotes: AppleNote[] = [];
			let loadedCustomFolders: NoteFolder[] = [];
			if (isAuthenticated) {
				try {
					const data = await fetchNotesAndFolders(untitledLabel);
					loadedNotes = data.notes;
					loadedCustomFolders = data.customFolders;
				} catch (e) {
					console.error('Failed to load notes from DB:', e);
				}
			}
			if (!isMounted) return;
			setNotes(loadedNotes);
			setFolders([...defaultFolders, ...loadedCustomFolders]);
			setIsLoading(false);
			setSelectedNoteId(loadedNotes.find((n) => !n.isDeleted)?.id || null);
		};
		void loadData();
		return () => {
			isMounted = false;
		};
	}, [isAuthenticated, defaultFolders, untitledLabel, setNotes, setFolders, setSelectedNoteId]);

	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		};
	}, []);

	const syncNoteToServer = useCallback(
		async (note: AppleNote) => {
			if (!isAuthenticated) {
				setSyncStatus('offline');
				return;
			}
			try {
				setSyncStatus('saving');
				setSyncStatus(await saveNoteToServer(note, untitledLabel));
			} catch {
				setSyncStatus('offline');
			}
		},
		[isAuthenticated, untitledLabel]
	);

	const scheduleSave = useCallback(
		(note: AppleNote) => {
			setSyncStatus('saving');
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = setTimeout(() => void syncNoteToServer(note), 400);
		},
		[syncNoteToServer]
	);

	return { syncStatus, isLoading, syncNoteToServer, scheduleSave };
}
