'use client';

import { useCallback, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import type { AppleNote } from '../types';
import { clampNoteBody, saveNoteToServer } from '../utils/notesApi';

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_NOTE_IMAGE_BYTES = 10 * 1024 * 1024;

export function useNoteImageUpload({
	activeNote,
	syncStatus,
	textareaRef,
	onUpdateBody,
}: {
	activeNote: AppleNote | null;
	syncStatus: 'saved' | 'saving' | 'offline';
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	onUpdateBody: (body: string) => void;
}) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isDraggingImage, setIsDraggingImage] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	const insertMarkdownAtSelection = useCallback(
		(markdown: string) => {
			if (!activeNote) return;
			const el = textareaRef.current;
			const currentBody = el ? el.value : activeNote.body;
			const start = el ? el.selectionStart : currentBody.length;
			const end = el ? el.selectionEnd : currentBody.length;
			const prefix = start > 0 && currentBody[start - 1] !== '\n' ? '\n' : '';
			const suffix = end < currentBody.length && currentBody[end] !== '\n' ? '\n' : '';
			const inserted = `${prefix}${markdown}${suffix}`;
			const nextBody = clampNoteBody(currentBody.slice(0, start) + inserted + currentBody.slice(end));
			onUpdateBody(nextBody);
			setTimeout(() => {
				if (!el) return;
				el.focus();
				const caret = Math.min(nextBody.length, start + inserted.length);
				el.setSelectionRange(caret, caret);
			}, 20);
		},
		[activeNote, onUpdateBody, textareaRef]
	);

	const uploadImageFile = useCallback(
		async (file: File) => {
			if (!activeNote || activeNote.isDeleted || isUploading) return;
			setUploadError(null);
			if (!ALLOWED_MIMES.has(file.type) || file.size <= 0 || file.size > MAX_NOTE_IMAGE_BYTES) {
				setUploadError(t('notesImageInvalidType'));
				return;
			}
			setIsUploading(true);
			try {
				if (syncStatus !== 'saved') {
					await saveNoteToServer(activeNote, t('notesUntitledNote'));
				}
				const formData = new FormData();
				formData.append('file', file);
				const res = await fetch(`/api/notes/upload?noteId=${encodeURIComponent(activeNote.id)}`, {
					method: 'POST',
					body: formData,
				});
				const payload = (await res.json().catch(() => null)) as {
					error?: string;
					url?: string;
				} | null;
				if (!res.ok || !payload?.url) {
					if (res.status === 413 && payload?.error === 'STORAGE_QUOTA_EXCEEDED') {
						setUploadError(t('notesImageQuotaExceeded'));
					} else if (res.status === 415) {
						setUploadError(t('notesImageInvalidType'));
					} else {
						setUploadError(payload?.error || t('notesImageUploadFailed'));
					}
					return;
				}
				playSystemSound();
				insertMarkdownAtSelection(`![image](${payload.url})`);
			} catch {
				setUploadError(t('notesImageUploadFailed'));
			} finally {
				setIsUploading(false);
			}
		},
		[activeNote, insertMarkdownAtSelection, isUploading, playSystemSound, syncStatus, t]
	);

	const handlePaste = useCallback(
		(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
			if (!activeNote || activeNote.isDeleted) return;
			const items = Array.from(e.clipboardData?.items ?? []);
			const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
			const file = imageItem?.getAsFile() ?? Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
			if (!file) return;
			e.preventDefault();
			void uploadImageFile(file);
		},
		[activeNote, uploadImageFile]
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent<HTMLElement>) => {
			if (!activeNote || activeNote.isDeleted) return;
			if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
			e.preventDefault();
			setIsDraggingImage(true);
		},
		[activeNote]
	);

	const handleDragLeave = useCallback(() => {
		setIsDraggingImage(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLElement>) => {
			setIsDraggingImage(false);
			if (!activeNote || activeNote.isDeleted) return;
			const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
			if (!file) return;
			e.preventDefault();
			void uploadImageFile(file);
		},
		[activeNote, uploadImageFile]
	);

	const handleFileInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			e.target.value = '';
			if (file) void uploadImageFile(file);
		},
		[uploadImageFile]
	);

	return {
		fileInputRef,
		isUploading,
		isDraggingImage,
		uploadError,
		clearUploadError: () => setUploadError(null),
		openFilePicker: () => fileInputRef.current?.click(),
		handlePaste,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleFileInputChange,
	};
}
