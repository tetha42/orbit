import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'mail',
	title: 'Mail & Inbox',
	shortTitle: 'Mail',
	description: 'Integrated community email client, inbox and communications dispatch',
	en: {
		title: 'Mail & Inbox',
		shortTitle: 'Mail',
		description: 'Integrated community email client, inbox and communications dispatch',
	},
	tr: {
		title: 'E-Posta & Gelen Kutusu',
		shortTitle: 'Posta',
		description: 'Topluluk e-postalarını görüntüleyin, yanıtlayın ve yönetin',
	},
	category: 'Operations',
	icon: 'Mail',
	accentColor: '#0a84ff',
	colors: { icon: '#0a84ff', menu: '#0a84ff', search: '#0a84ff' },
	window: {
		width: 1060,
		height: 680,
		minWidth: 760,
		minHeight: 480,
		x: 140,
		y: 70,
	},
	component: { module: './index', export: 'MailApp' },
	shortcut: '⌘9',
	order: 15,
	dock: 15,
	permission: {
		order: 15,
		name: 'Mail Center',
		use: 'View organization incoming and outgoing emails.',
		manage: 'Compose, send, and delete emails, and manage mailboxes.',
		warning: 'Grants direct full access to mailboxes; restrict to system administrators only.',
	},
	menu: {
		title: { tr: 'Posta', en: 'Mail' },
		about: { id: 'about-mail', label: { tr: 'Posta Hakkında', en: 'About Mail' }, permission: 'use', open: true },
		categories: [
			{
				id: 'mailbox',
				title: { tr: 'Posta Kutusu', en: 'Mailbox' },
				items: [
					{ id: 'mail-compose', label: { tr: 'Yeni İleti', en: 'New Message' }, shortcut: '⌘N', permission: 'manage', command: 'mail-compose' },
					{ id: 'mail-refresh', label: { tr: 'Postayı Yenile', en: 'Refresh Mail' }, shortcut: '⌘R', permission: 'use', command: 'mail-refresh' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
