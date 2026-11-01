export interface MemberTeamInfo {
	id: string;
	ad: string;
	kategori?: string;
	liderMi?: boolean;
	role?: string;
}

export interface MemberRecord {
	id: string;
	firstName: string;
	lastName: string;
	ad: string;
	soyad: string;
	email: string;
	handle: string;
	ogrenciNo?: string;
	department: string;
	bolum: string;
	grade: number;
	sinif: number;
	roleId?: string | null;
	roleName?: string | null;
	rolAd?: string | null;
	roleColor?: string | null;
	rolRenk?: string | null;
	avatarUrl?: string;
	profilFoto?: string;
	bio?: string;
	xp: number;
	status: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun';
	createdAt: number;
	olusturma: number;
	takimAdi?: string;
	takimlar?: MemberTeamInfo[];
	yoklamaSayisi?: number;
	diskUsageBytes?: number;
	fileCount?: number;
	customFields?: Record<string, string>;
}

export interface AssignableRole {
	id: string;
	ad: string;
	renk: string;
	assignableRoles: boolean;
}
