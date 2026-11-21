'use client';

import { copyToClipboard } from '@/lib/clipboard';
import type { AppleNote } from '../types';

export function useNoteExport({
	activeNote,
	textareaRef,
	handleUpdateBody,
	playSystemSound,
	setCopied,
	setShowShareMenu,
}: {
	activeNote: AppleNote | null;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	handleUpdateBody: (val: string) => void;
	playSystemSound: () => void;
	setCopied: (v: boolean) => void;
	setShowShareMenu: (v: boolean) => void;
}) {
	const insertTextAtCursor = (prefix: string, suffix = '') => {
		if (!textareaRef.current || !activeNote) return;
		playSystemSound();
		const textarea = textareaRef.current;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selected = text.substring(start, end);
		const nextValue = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
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
		if (line.includes('- [ ]')) lines[lineIndex] = line.replace('- [ ]', '- [x]');
		else if (line.includes('- [x]')) lines[lineIndex] = line.replace('- [x]', '- [ ]');
		handleUpdateBody(lines.join('\n'));
	};

	const handleCopyText = async () => {
		if (!activeNote) return;
		const copiedOk = await copyToClipboard(`${activeNote.title}\n\n${activeNote.body}`);
		if (!copiedOk) return;
		setCopied(true);
		playSystemSound();
		setTimeout(() => setCopied(false), 2000);
		setShowShareMenu(false);
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
		insertTextAtCursor,
		handleToggleChecklistItem,
		handleCopyText,
		handleDownloadMarkdown,
		handlePrint,
	};
}
