import notesContract from '../notes.contract.json';
import type { AppleNote, NoteFolder, ServerNoteRecord } from '../types';
import { mapServerNotes } from './noteHelpers';

export async function fetchNotesAndFolders(untitledLabel: string): Promise<{
	notes: AppleNote[];
	customFolders: NoteFolder[];
}> {
	const [notesRes, foldersRes] = await Promise.all([
		fetch('/api/notes'),
		fetch('/api/notes/folders'),
	]);

	let notes: AppleNote[] = [];
	let customFolders: NoteFolder[] = [];

	if (notesRes.ok) {
		const serverNotes: ServerNoteRecord[] = await notesRes.json();
		if (Array.isArray(serverNotes)) {
			notes = mapServerNotes(serverNotes, untitledLabel);
		}
	}

	if (foldersRes.ok) {
		const serverFolders = await foldersRes.json();
		if (Array.isArray(serverFolders)) {
			customFolders = serverFolders.map((sf: { id: string; name: string }) => ({
				id: sf.id,
				name: sf.name,
				isSystem: false,
				iconType: 'custom',
			}));
		}
	}

	return { notes, customFolders };
}

export async function saveNoteToServer(
	note: AppleNote,
	untitledLabel: string
): Promise<'saved' | 'offline'> {
	const trimmedBody = note.body.slice(0, notesContract.limits.maxNoteLength);
	const res = await fetch('/api/notes', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			id: note.id,
			title: note.title.trim() || untitledLabel,
			content: trimmedBody,
			folderId: note.folderId,
			color: note.folderId,
			isPinned: note.isPinned,
			isTrashed: Boolean(note.isDeleted),
		}),
	});
	return res.ok ? 'saved' : 'offline';
}

export function canPinAnotherNote(notes: AppleNote[], targetNote: AppleNote): boolean {
	if (targetNote.isPinned) return true;
	const pinnedCount = notes.filter((n) => n.isPinned && !n.isDeleted).length;
	return pinnedCount < notesContract.limits.maxPinnedNotes;
}

export function clampNoteBody(body: string): string {
	return body.length > notesContract.limits.maxNoteLength
		? body.slice(0, notesContract.limits.maxNoteLength)
		: body;
}
