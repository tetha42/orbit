import type { AppManifest } from '@/core/apps/manifest';

const manifest = {
	id: 'budget',
	title: 'Finance & Treasury',
	shortTitle: 'Finance',
	description: 'Financial ledger, budget allocations and expense vouchers',
	en: {
		title: 'Finance & Treasury',
		shortTitle: 'Finance',
		description: 'Financial ledger, budget allocations and expense vouchers',
	},
	tr: {
		title: 'Kasa & Finans Masası',
		shortTitle: 'Finans',
		description: 'Topluluk kasası, bütçe tahsisleri ve harcama takibi',
	},
	category: 'Finance',
	icon: 'DollarSign',
	accentColor: '#34c759',
	dockIcon: '/app-icons/calculator/256.png',
	window: {
		width: 880,
		height: 580,
		minWidth: 680,
		minHeight: 450,
		x: 140,
		y: 80,
	},
	component: { module: './index', export: 'BudgetApp' },
	shortcut: '⌘3',
	hotkey: '3',
	order: 2,
	dock: 3,
	permission: {
		sira: 8,
		ad: 'Finans',
		kullan: 'Kasaları ve hareketleri salt okunur görür.',
		yonet: 'Gelir/gider girer, düzeltir, siler, kasalar arası ödenek aktarır.',
	},
	menu: {
		title: { tr: 'Finans', en: 'Finance' },
		about: { id: 'about-budget', label: { tr: 'Mali İşler & Kasa Hakkında', en: 'About Community Treasury' } },
		categories: [
			{
				id: 'file',
				title: { tr: 'Kayıtlar', en: 'Records' },
				items: [
					{ id: 'new-entry', label: { tr: 'Gelir / Gider Ekle...', en: 'Add Ledger Entry...' }, shortcut: '⌘N', permission: 'yonet', komut: 'new-entry' },
					{ id: 'export-pdf', label: { tr: 'Mali Denetim Raporu Yazdır', en: 'Print Audit Report' }, shortcut: '⌘P', permission: 'kullan', komut: 'print-report' },
				],
			},
		],
	},
} as const satisfies AppManifest;

export default manifest;
