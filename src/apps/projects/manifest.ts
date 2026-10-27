import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'projects',
	title: 'Projects & Showcase',
	shortTitle: 'Projects',
	description: 'Innovation portfolio, open source initiatives and project showcase',
	en: {
		title: 'Projects & Showcase',
		shortTitle: 'Projects',
		description: 'Innovation portfolio, open source initiatives and project showcase',
	},
	tr: {
		title: 'Projeler & Vitrin',
		shortTitle: 'Projeler',
		description: 'Ar-Ge projeleri, açık kaynak yazılımlar ve proje vitrini',
	},
	category: 'Operations',
	icon: 'FolderGit2',
	accentColor: '#0a84ff',
	dockIcon: '/app-icons/view-source/256.png',
	badge: { tr: 'Yeni', en: 'New' },
	window: {
		width: 880,
		height: 580,
		minWidth: 640,
		minHeight: 440,
		x: 150,
		y: 70,
	},
	component: { module: './index', export: 'ProjectsApp' },
	order: 11,
	dock: 2,
	notifications: { projectProposal: 'yonet' },
	permission: {
		sira: 3,
		ad: 'Projeler',
		kullan: 'Proje vitrinini görür, yıldızlar, proje önerir.',
		yonet: 'Önerileri onaylar, yayınlar, arşivler, öne çıkarır.',
	},
} as const satisfies AppManifest;

export default manifest;
