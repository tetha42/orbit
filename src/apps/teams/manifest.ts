import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'teams',
	title: 'Teams & Kanban',
	shortTitle: 'Teams',
	description: 'R&D engineering teams, interactive Kanban sprint boards and repos',
	en: {
		title: 'Teams & Kanban',
		shortTitle: 'Teams',
		description: 'R&D engineering teams, interactive Kanban sprint boards and repos',
	},
	tr: {
		title: 'Takımlar & Kanban',
		shortTitle: 'Takımlar',
		description: 'Ar-Ge takımları, interaktif Kanban görev panoları ve repo bağlantıları',
	},
	category: 'Operations',
	icon: 'FolderGit2',
	accentColor: '#0a84ff',
	dockIcon: '/app-icons/vscode/256.png',
	window: {
		width: 920,
		height: 600,
		minWidth: 700,
		minHeight: 450,
		x: 75,
		y: 50,
		open: true,
	},
	component: { module: './index', export: 'TeamsApp' },
	shortcut: '⌘1',
	hotkey: '1',
	order: 0,
	dock: 0,
	notifications: { teamApplication: 'kullan', teamDecision: 'kullan', task: 'kullan', assigned: 'kullan' },
	permission: {
		sira: 2,
		ad: 'Takımlar',
		kullan: 'Takımlara katılır/başvurur, üyesi olduğu takımın görev panosunu kullanır.',
		yonet: 'Takım kurar, kaptan atar, tüm takımların üyelerini ve görevlerini yönetir.',
	},
	menu: {
		title: { tr: 'Takımlar', en: 'Teams' },
		about: { id: 'about-teams', label: { tr: 'Takımlar Hakkında', en: 'About Teams' }, permission: 'kullan', ac: true },
		categories: [
			{
				id: 'file',
				title: { tr: 'İşlemler', en: 'Actions' },
				items: [
					{ id: 'new-team', label: { tr: 'Yeni Takım Oluştur...', en: 'Create New Team...' }, shortcut: '⇧⌘N', permission: 'yonet', komut: 'new-team' },
					{ id: 'new-task', label: { tr: 'Yeni Görev Ekle', en: 'Add New Task' }, shortcut: '⌘N', permission: 'kullan', komut: 'new-task' },
					{ id: 'kanban-refresh', label: { tr: 'Panoyu ve Listeyi Yenile', en: 'Refresh Board & Catalog' }, shortcut: '⌘R', permission: 'kullan', komut: 'kanban-refresh' },
				],
			},
			{
				id: 'view',
				title: { tr: 'Görünüm', en: 'View' },
				items: [
					{ id: 'view-teams', label: { tr: 'Ar-Ge Takımları Paneli', en: 'R&D Teams' }, shortcut: '⌥1', permission: 'kullan', komut: 'view-teams' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
