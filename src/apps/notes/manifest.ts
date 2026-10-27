import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'notes',
	title: 'Notes & Docs',
	shortTitle: 'Notes',
	description: 'Personal scratchpad, Markdown documentation and collaborative checklists',
	en: {
		title: 'Notes & Docs',
		shortTitle: 'Notes',
		description: 'Personal scratchpad, Markdown documentation and collaborative checklists',
	},
	tr: {
		title: 'Notlar & Belgeler',
		shortTitle: 'Notlar',
		description: 'Kişisel notlar, Markdown belgeleri ve kontrol listeleri',
	},
	category: 'Productivity',
	icon: 'FileText',
	accentColor: '#eab308',
	colors: { icon: '#ffd60a', menu: '#ffd60a', search: '#ffcc00' },
	dockIcon: '/app-icons/notes/256.png',
	window: {
		width: 920,
		height: 580,
		minWidth: 640,
		minHeight: 420,
		x: 760,
		y: 70,
		z: 11,
	},
	component: { module: './index', export: 'NotesApp' },
	shortcut: '⌘8',
	hotkey: '8',
	order: 7,
	dock: 9,
	permission: {
		sira: 9,
		ad: 'Notlar',
		kullan: 'Kişisel notlarını tutar.',
		yonet: 'Kişisel notlarını tutar (yönetilecek ortak veri yok).',
	},
	menu: {
		title: { tr: 'Notlar', en: 'Notes' },
		about: { id: 'about-notes', label: { tr: 'Notlar Hakkında', en: 'About Notes' } },
		defaultItems: [
			{ id: 'new-note', label: { tr: 'Yeni Not', en: 'New Note' }, shortcut: '⌘N', permission: 'kullan', komut: 'new-note' },
		],
	},
} as const satisfies AppManifest;

export default manifest;
