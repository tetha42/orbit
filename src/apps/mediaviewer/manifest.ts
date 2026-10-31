import type { AppManifest } from '@/core/apps/manifest';

/**
 * Internal window-only app: chat media opens in a normal managed window, but it
 * is deliberately absent from the launcher, dock, Spotlight and role editor.
 */
const manifest = {
	id: 'mediaviewer',
	internal: true,
	title: 'Media Preview',
	shortTitle: 'Preview',
	description: 'Preview images, video, audio, PDF and text attachments',
	en: {
		title: 'Media Preview',
		shortTitle: 'Preview',
		description: 'Preview images, video, audio, PDF and text attachments',
	},
	tr: {
		title: 'Medya Önizleme',
		shortTitle: 'Önizleme',
		description: 'Görsel, video, ses, PDF ve metin eklerini önizleyin',
	},
	category: 'Productivity',
	icon: 'Image',
	accentColor: '#0a84ff',
	window: {
		width: 980,
		height: 720,
		minWidth: 420,
		minHeight: 300,
		x: 220,
		y: 70,
	},
	component: { module: './index', export: 'MediaViewerApp' },
	permission: {
		sira: 999,
		ad: 'Media Preview',
		kullan: 'Preview media attachments in a managed window.',
		yonet: 'Internal window-only app; no management actions.',
		herkeseAcik: true,
	},
} as const satisfies AppManifest;

export default manifest;
