'use client';

import React from 'react';
import {
	FileArchive,
	FileText,
	Film,
	ImageIcon,
	Music,
} from 'lucide-react';
import type { ChatAttachmentItem } from '../../types';

export type AttachmentKind =
	| 'image'
	| 'video'
	| 'audio'
	| 'pdf'
	| 'markdown'
	| 'text'
	| 'archive'
	| 'file';

export function formatAttachmentBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function attachmentKind(attachment: ChatAttachmentItem): AttachmentKind {
	const mime = (attachment.type || '').toLowerCase();
	const name = attachment.name.toLowerCase();
	if (mime.startsWith('image/')) return 'image';
	if (mime.startsWith('video/')) return 'video';
	if (mime.startsWith('audio/')) return 'audio';
	if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
	if (mime === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
	if (mime.startsWith('text/') || mime === 'application/json') return 'text';
	if (mime === 'application/zip' || name.match(/\.(zip|docx|xlsx|pptx|odt|ods|odp|epub|doc|xls|ppt)$/)) return 'archive';
	return 'file';
}

export function fileAttachmentIcon(kind: AttachmentKind) {
	if (kind === 'image') return <ImageIcon size={16} />;
	if (kind === 'video') return <Film size={16} />;
	if (kind === 'audio') return <Music size={16} />;
	if (kind === 'archive') return <FileArchive size={16} />;
	return <FileText size={16} />;
}
