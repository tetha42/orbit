import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'members',
	title: 'Directory & Roster',
	shortTitle: 'Directory',
	description: 'Community member directory, talent profiles and organizational roster',
	en: {
		title: 'Directory & Roster',
		shortTitle: 'Directory',
		description: 'Community member directory, talent profiles and organizational roster',
	},
	tr: {
		title: 'Üye Rehberi & Kadro',
		shortTitle: 'Rehber',
		description: 'Topluluk üye rehberi, yetenek profilleri ve yönetim kadrosu',
	},
	category: 'Community',
	icon: 'Users',
	accentColor: '#007aff',
	colors: { search: '#34c759' },
	dockIcon: '/app-icons/contacts/256.png',
	badge: { tr: 'Aktif', en: 'Active' },
	window: {
		width: 800,
		height: 540,
		minWidth: 620,
		minHeight: 420,
		x: 130,
		y: 75,
	},
	component: { module: './index', export: 'MemberDirectoryApp' },
	shortcut: '⌘7',
	hotkey: '7',
	order: 6,
	dock: 8,
	notifications: { approval: 'yonet' },
	permission: {
		sira: 6,
		ad: 'Üyeler',
		kullan: 'Aktif üyeleri ve iletişim bilgilerini görür.',
		yonet: 'Başvuruları onaylar, üye ekler/çıkarır, role atar.',
	},
	menu: {
		title: { tr: 'Rehber', en: 'Directory' },
		about: { id: 'about-members', label: { tr: 'Üye Rehberi Hakkında', en: 'About Member Directory' } },
		categories: [
			{
				id: 'file',
				title: { tr: 'Kayıt', en: 'Roster' },
				items: [
					{ id: 'add-member', label: { tr: 'Yeni Üye Ekle...', en: 'Register Member...' }, shortcut: '⌘N', permission: 'yonet', komut: 'add-member' },
					{ id: 'refresh-members', label: { tr: 'Listeyi Yenile', en: 'Refresh Members' }, shortcut: '⌘R', permission: 'kullan', komut: 'refresh' },
					{ id: 'export-roster', label: { tr: 'Üye Listesini Dışa Aktar (CSV)', en: 'Export Member Roster (CSV)' }, permission: 'kullan' },
				],
			},
			{
				id: 'view',
				title: { tr: 'Görünüm', en: 'View' },
				items: [
					{ id: 'view-all', label: { tr: 'Tüm Üyeler', en: 'All Members' }, shortcut: '⌥1', permission: 'kullan', komut: 'filter-all' },
					{ id: 'view-active', label: { tr: 'Aktif Üyeler', en: 'Active Members' }, shortcut: '⌥2', permission: 'kullan', komut: 'filter-active' },
					{ id: 'view-pending', label: { tr: 'Onay Bekleyenler', en: 'Pending Members' }, shortcut: '⌥3', permission: 'yonet', komut: 'filter-pending' },
					{ id: 'view-alumni', label: { tr: 'Mezunlar', en: 'Alumni' }, shortcut: '⌥4', permission: 'kullan', komut: 'filter-alumni' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
