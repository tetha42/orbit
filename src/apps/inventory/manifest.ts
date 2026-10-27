import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'inventory',
	title: 'Assets & Inventory',
	shortTitle: 'Assets',
	description: 'Hardware lab assets, microcontroller devboards and equipment custody',
	en: {
		title: 'Assets & Inventory',
		shortTitle: 'Assets',
		description: 'Hardware lab assets, microcontroller devboards and equipment custody',
	},
	tr: {
		title: 'Donanım & Envanter',
		shortTitle: 'Envanter',
		description: 'Laboratuvar donanımları, geliştirme kitleri ve zimmet takip sistemi',
	},
	category: 'Operations',
	icon: 'Cpu',
	accentColor: '#30b0c7',
	colors: { search: '#0a84ff' },
	dockIcon: '/app-icons/appstore/256.png',
	window: {
		width: 840,
		height: 560,
		minWidth: 640,
		minHeight: 440,
		x: 210,
		y: 90,
	},
	component: { module: './index', export: 'InventoryApp' },
	shortcut: '⌘6',
	hotkey: '6',
	order: 5,
	dock: 7,
	notifications: { loan: 'kullan' },
	permission: {
		sira: 5,
		ad: 'Envanter',
		kullan: 'Envanteri görür, ödünç alır, iade eder, süre uzatır.',
		yonet: 'Eşya ekler/düzenler, üye adına ödünç verir, arızalı/kayıp işaretler.',
	},
	menu: {
		title: { tr: 'Envanter', en: 'Assets' },
		about: { id: 'about-inventory', label: { tr: 'Donanım Envanteri Hakkında', en: 'About Asset Inventory' }, permission: 'kullan', ac: true },
	},
} as const satisfies AppManifest;

export default manifest;
