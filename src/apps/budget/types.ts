import type { VaultSummary } from '@/types/budget';

export interface VaultRecord {
	id: string;
	date: number;
	olusturma?: number;
	tur: 'gelir' | 'gider';
	kategori: string;
	tutarKurus: number;
	aciklama: string;
	fisFotoUrl: string | null;
	kaydedenId: string;
	kaydedenAdSoyad: string | null;
	aktarimId?: string | null;
	karsiKasaAd?: string | null;
	guncelleyenAdSoyad?: string | null;
	guncellenme?: number | null;
}

export interface CashTotals {
	toplamGelirKurus: number;
	toplamGiderKurus: number;
	netBakiyeKurus: number;
	kayitSayisi: number;
}

export interface VaultResponse {
	kasa: { teamId: string | null; ad: string; kind: 'genel' | 'proje' };
	kayitlar: VaultRecord[];
	ozet: CashTotals;
	/** What the caller may do here (lib/kasaAccess): write entries; manage (transfers). */
	izin: { yaz: boolean; yonet: boolean };
}

export type { VaultSummary };

/** "Genel Kasa" or the project's name, for the transfer form. */
export const vaultKey = (teamId: string | null) => teamId ?? 'genel';
