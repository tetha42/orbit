import type { InventoryStatus } from '@/types/inventory';
export type { InventoryStatus };

export interface InventoryItem {
	id: string;
	code: string;
	name: string;
	category: string;
	status: InventoryStatus;
	location: string;
	loanFieldId: string | null;
	loanFieldNameSurname: string | null;
	returnDate: number | null;
	loanDate: number | null;
	description: string | null;
	seriesNo: string | null;
}

export type Filter = 'hepsi' | InventoryStatus | 'gecikmis' | 'bende';

export const CATEGORY_SUGGESTIONS = [
	'Geliştirme Kartı',
	'Gömülü Sistem',
	'Sensör',
	'Test Ekipmanı',
	'3D Yazıcı',
	'Robotik',
	'Ağ Ekipmanı',
	'Bilgisayar',
	'Kablo & Aksesuar',
];

export const trDate = (ms: number) =>
	new Date(ms).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
