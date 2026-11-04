export interface Certificate {
	id: string;
	verificationCode: string;
	userId: string;
	kullaniciAdSoyad: string;
	etkinlikId: string | null;
	baslik: string;
	kategori?: string | null;
	dil?: string | null;
	aciklama?: string | null;
	verilisTarihi: number;
	pdfUrl: string | null;
}

export interface MemberRankItem {
	id: string;
	firstName?: string;
	lastName?: string;
	department?: string;
	grade?: number;
	roleName?: string | null;
	teamName?: string | null;
	ad: string;
	soyad: string;
	bolum: string;
	sinif: number;
	xp: number;
	rolAd?: string | null;
	takimAdi: string | null;
}
