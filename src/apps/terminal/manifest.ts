import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'terminal',
	title: 'Terminal & Shell',
	shortTitle: 'Terminal',
	description: 'Interactive Linux PTY terminal and host system shell for operators',
	en: {
		title: 'Terminal & Shell',
		shortTitle: 'Terminal',
		description: 'Interactive Linux PTY terminal and host system shell for operators',
	},
	tr: {
		title: 'Terminal & Sistem Kabuğu',
		shortTitle: 'Terminal',
		description: 'Yöneticiler için xterm tabanlı etkileşimli Linux kabuk arayüzü',
	},
	category: 'Operations',
	icon: 'Terminal',
	accentColor: '#1c1f26',
	colors: { icon: '#30d158', menu: '#30d158', search: '#30d158' },
	dockIcon: '/app-icons/terminal/256.png',
	badge: 'SSH',
	window: {
		width: 840,
		height: 520,
		minWidth: 540,
		minHeight: 360,
		x: 280,
		y: 140,
	},
	component: { module: './index', export: 'TerminalApp' },
	shortcut: '⌘T',
	order: 10,
	dock: 11,
	permission: {
		sira: 11,
		ad: 'Terminal',
		kullan: 'Sunucuda kabuk (shell) açar.',
		yonet: 'Sunucuda kabuk (shell) açar.',
		uyari: 'Terminal sunucuya tam erişim verir; yalnızca güvendiğiniz kişilere açın.',
	},
	menu: {
		title: { tr: 'Terminal', en: 'Terminal' },
	},
} as const satisfies AppManifest;

export default manifest;
