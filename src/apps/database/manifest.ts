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
	dockIcon: '/app-icons/database/256.png',
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
		sira: 14,
		ad: 'Veritabanı',
		kullan: 'Veritabanı tablolarını görüntüler.',
		yonet: 'Veritabanı tablolarını ve kayıtlarını doğrudan düzenler.',
		uyari: 'Veritabanına doğrudan tam erişim verir; yalnızca sistem yöneticilerine açılmalıdır.',
	},
	menu: {
		title: { tr: 'Veritabanı', en: 'Database' },
	},
} as const satisfies AppManifest;

export default manifest;
