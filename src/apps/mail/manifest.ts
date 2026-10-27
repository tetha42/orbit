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
		sira: 15,
		ad: 'Posta',
		kullan: 'Topluluk gelen/giden e-postalarını görüntüler.',
		yonet: 'E-posta gönderir, siler ve kutuları yönetir.',
		uyari: 'E-posta kutusuna doğrudan tam erişim verir; yalnızca sistem yöneticilerine açılmalıdır.',
	},
	menu: {
		title: { tr: 'Posta', en: 'Mail' },
		about: { id: 'about-mail', label: { tr: 'Posta Hakkında', en: 'About Mail' }, permission: 'kullan', ac: true },
		categories: [
			{
				id: 'mailbox',
				title: { tr: 'Posta Kutusu', en: 'Mailbox' },
				items: [
					{ id: 'mail-compose', label: { tr: 'Yeni İleti', en: 'New Message' }, shortcut: '⌘N', permission: 'yonet', komut: 'mail-compose' },
					{ id: 'mail-refresh', label: { tr: 'Postayı Yenile', en: 'Refresh Mail' }, shortcut: '⌘R', permission: 'kullan', komut: 'mail-refresh' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
