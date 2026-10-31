import type { NewsVisibility } from '@/types/news';

export interface NewsEntry {
	id: string;
	slug: string;
	baslik: string;
	ozet: string;
	icerik: string;
	kategori: string;
	onemliMi: number;
	resimUrl?: string;
	publishStatus: NewsVisibility;
	yayinTarihi: number | null;
	yazarId?: string;
	yazarAdSoyad?: string;
	olusturma: number;
	guncellenme: number;
}
