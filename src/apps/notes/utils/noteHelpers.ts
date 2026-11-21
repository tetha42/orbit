import type { AppleNote, NoteFolder, ServerNoteRecord } from '../types';

export function formatNoteDate(timestamp: number, locale: string, yesterdayLabel: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
	}
	const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
	if (diffDays === 1) return yesterdayLabel;
	if (diffDays < 7) {
		return date.toLocaleDateString(locale, { weekday: 'short' });
	}
	return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function getFolderDisplayName(
	fld: NoteFolder | null | undefined,
	t: (key: string) => string
): string {
	if (!fld) return t('notesFolderQuick');
	if (!fld.isSystem) return fld.name;
	switch (fld.id) {
		case 'all': return t('notesFolderAll');
		case 'quick': return t('notesFolderQuick');
		case 'club': return t('notesFolderClub');
		case 'teknofest': return t('notesFolderTeknofest');
		case 'workshops': return t('notesFolderWorkshops');
		case 'personal': return t('notesFolderPersonal');
		case 'trash': return t('notesFolderTrash');
		default: return fld.name;
	}
}

export function getNotePreviewSnippet(body: string, fallback: string): string {
	if (!body || !body.trim()) return fallback;
	const clean = body
		.replace(/^#+\s+/gm, '')
		.replace(/\[\s*x?\s*\]/gi, '')
		.replace(/[-*]\s+/gm, '')
		.trim();
	return clean.slice(0, 80) || fallback;
}

export function mapServerNotes(serverNotes: ServerNoteRecord[], untitledLabel: string): AppleNote[] {
	return serverNotes.map((sn) => {
		let parsedBody = sn.content || '';
		let folderId = sn.folderId || sn.color || 'quick';
		let isDeleted = Boolean(sn.isTrashed);

		if (typeof sn.content === 'string' && sn.content.startsWith('{') && sn.content.includes('"body"')) {
			try {
				const obj = JSON.parse(sn.content);
				if (obj.body !== undefined) parsedBody = obj.body;
				if (obj.folderId) folderId = obj.folderId;
				if (obj.isDeleted !== undefined) isDeleted = Boolean(obj.isDeleted);
			} catch {
				// Plain text
			}
		}

		return {
			id: sn.id,
			title: sn.title || untitledLabel,
			body: parsedBody,
			folderId,
			isPinned: Boolean(sn.isPinned),
			isDeleted,
			createdAt: Number(sn.createdAt) || Date.now(),
			updatedAt: Number(sn.updatedAt) || Date.now(),
		};
	});
}
