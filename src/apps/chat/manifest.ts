import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'chat',
	title: 'Messages & Channels',
	shortTitle: 'Messages',
	description: 'Real-time community messaging and team collaboration channels',
	en: {
		title: 'Messages & Channels',
		shortTitle: 'Messages',
		description: 'Real-time community messaging and team collaboration channels',
	},
	tr: {
		title: 'Mesajlar & Kanallar',
		shortTitle: 'Mesajlar',
		description: 'Topluluk içi anlık mesajlaşma ve takım sohbet kanalları',
	},
	category: 'Community',
	icon: 'MessageSquare',
	accentColor: '#34c759',
	window: {
		width: 960,
		height: 600,
		minWidth: 720,
		minHeight: 440,
		x: 130,
		y: 60,
	},
	component: { module: './index', export: 'ChatApp' },
	shortcut: '⌘9',
	hotkey: '9',
	order: 12,
	dock: 12,
	notifications: { message: 'use' },
	permission: {
		order: 10,
		name: 'Mesajlar',
		use: 'Sohbet odalarını görüntüler ve mesaj yazar (herkese açık).',
		manage: 'Sohbet odalarını ve mesajları yönetir.',
		everyoneOpen: true,
	},
	menu: {
		title: { tr: 'Mesajlar', en: 'Messages' },
		about: { id: 'about-chat', label: { tr: 'Mesajlar Hakkında', en: 'About Messages' }, permission: 'use', ac: true },
		categories: [
			{
				id: 'file',
				title: { tr: 'Mesajlar', en: 'Messages' },
				items: [
					{ id: 'chat-refresh', label: { tr: 'Sohbeti Yenile', en: 'Refresh Chat' }, shortcut: '⌘R', permission: 'use', command: 'chat-refresh' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
