export interface ChatOdaItem {
	id: string;
	tur: 'genel' | 'takim' | 'ozel';
	teamId: string | null;
	ad: string;
	olusturma: number;
	avatar?: string | null;
	peerUserId?: string | null;
	memberCount?: number;
	sonMesaj?: ChatMessageItem | null;
	okunmamisSayisi?: number;
}

export interface ChatPollOptionItem {
	id: string;
	pollId: string;
	sira: number;
	metin: string;
	oySayisi: number;
	yuzde: number;
	oyVerenler?: Array<{ id: string; ad: string; foto?: string | null }>;
}

export interface ChatPollItem {
	id: string;
	mesajId: string;
	odaId: string;
	olusturanId: string;
	olusturanAd?: string;
	soru: string;
	cokluSecim: boolean;
	anonim: boolean;
	endsAt: number | null;
	kapali: boolean;
	olusturma: number;
	secenekler: ChatPollOptionItem[];
	toplamOy: number;
	kullaniciOylari: string[];
}

export interface QuotedMessageSnapshot {
	id: string;
	gonderenAd: string;
	icerik: string;
}

export interface ChatAttachmentItem {
	ad: string;
	url: string;
	boyut?: number;
	tip?: string;
}

export interface ChatMessageItem {
	id: string;
	odaId: string;
	gonderenId: string;
	gonderenAd: string;
	gonderenFoto: string | null;
	icerik: string;
	ekler: ChatAttachmentItem[];
	date: number;
	silinmeTarihi?: number | null;
	duzenlenmeTarihi?: number | null;
	anket?: ChatPollItem | null;
	yanitlananMesajId?: string | null;
	yanitlananMesaj?: QuotedMessageSnapshot | null;
	iletildiMi?: boolean;
}

export interface ChatContactItem {
	id: string;
	ad: string;
	soyad: string;
	profilFoto: string | null;
	rolAd: string | null;
	bolum: string;
}

export interface ChatRoomMemberItem {
	id: string;
	ad: string;
	soyad: string;
	profilFoto: string | null;
	rolAd: string | null;
	bolum: string;
}
