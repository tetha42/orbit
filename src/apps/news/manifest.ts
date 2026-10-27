import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'news',
	title: 'News & Broadcasts',
	shortTitle: 'News',
	description: 'Community announcements, press dispatches and official broadcasts',
	en: {
		title: 'News & Broadcasts',
		shortTitle: 'News',
		description: 'Community announcements, press dispatches and official broadcasts',
	},
	tr: {
		title: 'Duyurular & Bültenler',
		shortTitle: 'Haberler',
		description: 'Resmi duyurular, yarışmalar ve topluluk bültenleri',
	},
	category: 'Community',
	icon: 'Newspaper',
	accentColor: '#ff2d55',
	colors: { search: '#ff9f0a' },
	dockIcon: '/app-icons/news/256.png',
	badge: { tr: 'Yeni', en: 'New' },
	window: {
		width: 880,
		height: 600,
		minWidth: 660,
		minHeight: 450,
		x: 220,
		y: 85,
	},
	component: { module: './index', export: 'NewsApp' },
	order: 8,
	dock: 5,
	notifications: { news: 'kullan' },
	permission: {
		sira: 0,
		ad: 'Haberler',
		kullan: 'Duyuruları ve haberleri okur.',
		yonet: 'Haber yazar, yayınlar, düzenler, siler.',
	},
} as const satisfies AppManifest;

export default manifest;
