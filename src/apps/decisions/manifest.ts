import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'decisions',
	title: 'Governance & Committees',
	shortTitle: 'Governance',
	description: 'Committees, meetings, decisions and voting records',
	en: {
		title: 'Governance & Committees',
		shortTitle: 'Governance',
		description: 'Committees, meetings, decisions and voting records',
	},
	tr: {
		title: 'Yönetişim & Komiteler',
		shortTitle: 'Yönetişim',
		description: 'Komiteler, toplantılar, kararlar ve oy kayıtları',
	},
	category: 'Community',
	icon: 'Landmark',
	accentColor: '#bf5af2',
	colors: { icon: '#bf5af2', menu: '#bf5af2', search: '#da8fff' },
	window: {
		width: 960,
		height: 640,
		minWidth: 760,
		minHeight: 480,
		x: 120,
		y: 60,
	},
	component: { module: './index', export: 'DecisionsApp' },
	order: 14,
	dock: 14,
	permission: {
		sira: 16,
		ad: 'Kararlar & Komiteler',
		kullan: 'Komiteleri, toplantıları ve kamuya açık kararları görür.',
		yonet: 'Komite kurar, üye/oy hakkı atar, toplantı ve karar kaydı oluşturur.',
	},
	menu: {
		title: { tr: 'Yönetişim', en: 'Governance' },
		about: {
			id: 'about-decisions',
			label: { tr: 'Yönetişim Hakkında', en: 'About Governance' },
			permission: 'kullan',
			ac: true,
		},
		categories: [
			{
				id: 'file',
				title: { tr: 'İşlemler', en: 'Actions' },
				items: [
					{
						id: 'new-committee',
						label: { tr: 'Yeni Komite...', en: 'New Committee...' },
						shortcut: '⇧⌘N',
						permission: 'yonet',
						komut: 'new-committee',
					},
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
