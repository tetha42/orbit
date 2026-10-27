export interface MemberTeamInfo {
	id: string;
	ad: string;
	kategori?: string;
	liderMi?: boolean;
	role?: string;
}

export interface MemberRecord {
	id: string;
	ad: string;
	soyad: string;
	email: string;
	ogrenciNo?: string;
	bolum: string;
	sinif: number;
	roleId?: string | null;
	rolAd?: string | null;
	rolRenk?: string | null;
	profilFoto?: string;
	bio?: string;
	xp: number;
	status: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun';
	olusturma: number;
	takimAdi?: string;
	takimlar?: MemberTeamInfo[];
	yoklamaSayisi?: number;
}

export interface AtanabilirRol {
	id: string;
	ad: string;
	renk: string;
	atanabilir: boolean;
}
