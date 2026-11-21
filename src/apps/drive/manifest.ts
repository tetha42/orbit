import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'drive',
	title: 'Cloud Drive',
	shortTitle: 'Drive',
	description: 'Cloud file storage, folders, sharing, and organization quota management.',
	en: {
		title: 'Cloud Drive',
		shortTitle: 'Drive',
		description: 'Cloud file storage, folders, sharing, and organization quota management.',
	},
	tr: {
		title: 'Bulut Sürücü',
		shortTitle: 'Sürücü',
		description: 'Bulut dosya depolama, klasörler, paylaşım ve kurum kota yönetimi.',
	},
	category: 'Productivity',
	icon: 'HardDrive',
	accentColor: '#3b82f6',
	colors: { icon: '#3b82f6', menu: '#3b82f6', search: '#60a5fa' },
	window: {
		width: 980,
		height: 620,
		minWidth: 700,
		minHeight: 460,
		x: 210,
		y: 80,
		z: 12,
	},
	component: { module: './index', export: 'DriveApp' },
	order: 8,
	dock: 13,
	permission: {
		order: 10,
		name: 'Cloud Drive',
		use: 'Upload, organize, and share files within your assigned storage quota.',
		manage: 'Configure global, role, and member storage quotas and audit organization storage usage.',
	},
	menu: {
		title: { tr: 'Sürücü', en: 'Drive' },
		about: { id: 'about-drive', label: { tr: 'Sürücü Hakkında', en: 'About Drive' } },
		defaultItems: [
			{
				id: 'drive-new-folder',
				label: { tr: 'Yeni Klasör', en: 'New Folder' },
				shortcut: '⌘N',
				permission: 'use',
				command: 'drive-new-folder',
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
