import type { EnvanterDurum } from '@/types/inventory';
export type { EnvanterDurum };

export interface InventoryItem {
	id: string;
	kod: string;
	ad: string;
	kategori: string;
	status: EnvanterDurum;
	konum: string;
	oduncAlanId: string | null;
	oduncAlanAdSoyad: string | null;
	iadeTarihi: number | null;
	oduncTarihi: number | null;
	aciklama: string | null;
	seriNo: string | null;
}

export type Filter = 'hepsi' | EnvanterDurum | 'gecikmis' | 'bende';

export const KATEGORI_ONERILERI = [
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
