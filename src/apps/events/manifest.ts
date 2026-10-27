import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'events',
	title: 'Events & Calendar',
	shortTitle: 'Events',
	description: 'Community calendar, workshops, pass tickets and smart QR check-in',
	en: {
		title: 'Events & Calendar',
		shortTitle: 'Events',
		description: 'Community calendar, workshops, pass tickets and smart QR check-in',
	},
	tr: {
		title: 'Etkinlikler & Takvim',
		shortTitle: 'Etkinlikler',
		description: 'Topluluk takvimi, atölyeler, dijital biletler ve akıllı QR yoklama',
	},
	category: 'Operations',
	icon: 'CalendarCheck',
	accentColor: '#0a84ff',
	colors: { menu: '#ff3b30', search: '#ff3b30' },
	dockIcon: '/app-icons/calendar/256.png',
	badge: { tr: 'Canlı', en: 'Live' },
	window: {
		width: 860,
		height: 580,
		minWidth: 650,
		minHeight: 440,
		x: 110,
		y: 65,
	},
	component: { module: './index', export: 'EventsApp' },
	shortcut: '⌘2',
	hotkey: '2',
	order: 1,
	dock: 1,
	notifications: { checkin: 'kullan', event: 'kullan' },
	permission: {
		sira: 1,
		ad: 'Etkinlikler',
		kullan: 'Etkinliklere kaydolur, bilet ve QR yoklama kullanır.',
		yonet: 'Etkinlik oluşturur, yoklama alır, katılımcı listesini görür ve indirir.',
	},
	menu: {
		title: { tr: 'Etkinlikler', en: 'Events' },
		about: { id: 'about-events', label: { tr: 'Etkinlik Yönetimi Hakkında', en: 'About Events Management' } },
		categories: [
			{
				id: 'file',
				title: { tr: 'İşlemler', en: 'Actions' },
				items: [
					{ id: 'new-event', label: { tr: 'Yeni CommunityEvent...', en: 'New Event...' }, shortcut: '⌘N', permission: 'yonet', komut: 'new-event' },
					{ id: 'projector-qr', label: { tr: 'Projeksiyon QR Modu', en: 'Projector QR Mode' }, shortcut: '⌘P', permission: 'yonet', komut: 'projector' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
