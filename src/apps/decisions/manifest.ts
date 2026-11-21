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
		order: 16,
		name: 'Decisions & Committees',
		use: 'View committees, meetings, and public board resolutions.',
		manage: 'Form committees, assign voting rights, record meetings and publish resolutions.',
	},
	menu: {
		title: { tr: 'Yönetişim', en: 'Governance' },
		about: {
			id: 'about-decisions',
			label: { tr: 'Yönetişim Hakkında', en: 'About Governance' },
			permission: 'use',
			open: true,
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
						permission: 'manage',
						command: 'new-committee',
					},
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
