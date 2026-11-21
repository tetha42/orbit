import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'database',
	title: 'Database Studio',
	shortTitle: 'Database',
	description: 'PostgreSQL table explorer, inline cell editor and SQL query console',
	en: {
		title: 'Database Studio',
		shortTitle: 'Database',
		description: 'PostgreSQL table explorer, inline cell editor and SQL query console',
	},
	tr: {
		title: 'Veritabanı Masası',
		shortTitle: 'Veritabanı',
		description: 'PostgreSQL tablo yöneticisi, veri düzenleyici ve SQL konsolu',
	},
	category: 'Operations',
	icon: 'Database',
	accentColor: '#0a84ff',
	colors: { icon: '#0a84ff', menu: '#0a84ff', search: '#0a84ff' },
	dockIcon: '/app-icons/devutils/256.webp',
	badge: 'SQL',
	window: {
		width: 980,
		height: 640,
		minWidth: 720,
		minHeight: 480,
		x: 160,
		y: 80,
	},
	component: { module: './index', export: 'DatabaseApp' },
	shortcut: '⌘D',
	order: 14,
	dock: 14,
	permission: {
		order: 14,
		name: 'Database Studio',
		use: 'Browse database tables and view records in read-only mode.',
		manage: 'Execute SQL queries, edit tables and modify records directly.',
		warning: 'Grants direct full access to the database; restrict to system administrators only.',
	},
	menu: {
		title: { tr: 'Veritabanı', en: 'Database' },
	},
} as const satisfies AppManifest;

export default manifest;
