import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'settings',
	title: 'System Settings',
	shortTitle: 'Settings',
	description: 'Preferences, identity, access control roles, SMTP and security',
	en: {
		title: 'System Settings',
		shortTitle: 'Settings',
		description: 'Preferences, identity, access control roles, SMTP and security',
	},
	tr: {
		title: 'Sistem Ayarları',
		shortTitle: 'Ayarlar',
		description: 'Kullanıcı tercihleri, roller, güvenlik ve topluluk ayarları',
	},
	category: 'Productivity',
	icon: 'Settings',
	accentColor: '#8e8e93',
	dockIcon: '/app-icons/system-preferences/256.png',
	window: {
		width: 720,
		height: 520,
		minWidth: 540,
		minHeight: 400,
		x: 250,
		y: 120,
	},
	component: { module: './index', export: 'SettingsApp' },
	shortcut: '⌘,',
	hotkey: ',',
	order: 9,
	dock: 10,
	permission: {
		order: 12,
		name: 'Settings & System',
		use: 'Manage personal account, security, 2FA, and appearance preferences (open to everyone).',
		manage: 'Manage roles and permissions, configure SMTP mail, and update organization profile.',
		everyoneOpen: true,
	},
	menu: {
		title: { tr: 'Ayarlar', en: 'Settings' },
		about: { id: 'about-settings', label: { tr: 'Sistem Ayarları Hakkında', en: 'About System Preferences' } },
	},
} as const satisfies AppManifest;

export default manifest;
