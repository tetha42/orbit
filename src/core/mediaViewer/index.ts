'use client';

import { useSyncExternalStore } from 'react';

export type MediaPreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported';
export interface MediaViewerItem {
	ad: string;
	url: string;
	boyut?: number;
	tip?: string;
}

let current: MediaViewerItem | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** Opens the floating media viewer. Called from chat attachments on click/tap. */
export function openMediaViewer(item: MediaViewerItem): void {
	current = item;
	emit();
}

export function closeMediaViewer(): void {
	if (!current) return;
	current = null;
	emit();
}

export function useMediaViewerItem(): MediaViewerItem | null {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const IMAGE_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/bmp',
	'image/x-icon',
	'image/vnd.microsoft.icon',
	'image/svg+xml',
]);

const EXTENSION_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	svg: 'image/svg+xml',
	mp4: 'video/mp4',
	webm: 'video/webm',
	ogv: 'video/ogg',
	mov: 'video/quicktime',
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	oga: 'audio/ogg',
	m4a: 'audio/mp4',
	flac: 'audio/flac',
	weba: 'audio/webm',
	pdf: 'application/pdf',
	txt: 'text/plain',
	md: 'text/markdown',
	markdown: 'text/markdown',
	csv: ['text', 'csv'].join('/'),
	json: 'application/json',
	xml: 'application/xml',
	log: 'text/plain',
};

function extensionOf(name: string): string {
	const index = name.lastIndexOf('.');
	return index >= 0 ? name.slice(index + 1).toLowerCase() : '';
}

function mimeOf(item: MediaViewerItem): string {
	const declared = (item.tip || '').toLowerCase().trim();
	if (declared) return declared;
	return EXTENSION_TYPES[extensionOf(item.ad)] || '';
}

function browserSupports(kind: 'video' | 'audio', mime: string): boolean {
	if (typeof document === 'undefined' || !mime) return true;
	const element = document.createElement(kind);
	return Boolean(element.canPlayType(mime));
}

/**
 * What the browser can actually render in-window. Anything else is downloaded
 * rather than opening a broken viewer.
 */
export function mediaPreviewKind(item: MediaViewerItem): MediaPreviewKind {
	const mime = mimeOf(item);
	const name = item.ad.toLowerCase();
	if (mime.startsWith('image/')) return IMAGE_TYPES.has(mime) ? 'image' : 'unsupported';
	if (mime.startsWith('video/')) return browserSupports('video', mime) ? 'video' : 'unsupported';
	if (mime.startsWith('audio/')) return browserSupports('audio', mime) ? 'audio' : 'unsupported';
	if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
	if (
		mime.startsWith('text/') ||
		mime === 'application/json' ||
		mime === 'application/xml' ||
		name.endsWith('.md') ||
		name.endsWith('.markdown') ||
		name.endsWith('.json') ||
		name.endsWith('.csv') ||
		name.endsWith('.xml')
	) {
		return 'text';
	}
	return 'unsupported';
}

/** Triggers the browser's own download flow; the file route is same-origin. */
export function downloadMedia(item: MediaViewerItem): void {
	if (typeof document === 'undefined') return;
	const anchor = document.createElement('a');
	anchor.href = item.url;
	anchor.download = item.ad || 'attachment';
	anchor.rel = 'noreferrer noopener';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

/**
 * Entry point for every chat media click: preview when the browser supports it,
 * otherwise download it immediately.
 */
export function openMediaAttachment(item: MediaViewerItem): boolean {
	if (mediaPreviewKind(item) === 'unsupported') {
		downloadMedia(item);
		return false;
	}
	openMediaViewer(item);
	return true;
}
