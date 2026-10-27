/**
 * Canonical inventory status vocabulary.
 *
 * Three different sets had grown up independently — the UI compared against
 * `'oduncte'`, the API wrote `'odunc_verildi'`, and the storage type mentioned
 * `'onarimda'`. A borrowed item therefore matched nothing and rendered under the
 * "ARIZALI" label.
 *
 * Both the API and the UI import from here so this cannot drift again.
 */
export const ENVANTER_DURUMLARI = ['saglam', 'oduncte', 'arizali', 'kayip'] as const;

export type EnvanterDurum = (typeof ENVANTER_DURUMLARI)[number];

/** Turkish labels for the status badges and filters. */
export const ENVANTER_DURUM_ETIKETI: Record<EnvanterDurum, string> = {
	saglam: 'MÜSAİT',
	oduncte: 'ÖDÜNÇTE',
	arizali: 'ARIZALI',
	kayip: 'KAYIP',
};

/** Filter labels, including the "show everything" option. */
export const ENVANTER_FILTRE_ETIKETI: Record<EnvanterDurum | 'hepsi', string> = {
	hepsi: 'Tümü',
	saglam: 'Müsait',
	oduncte: 'Ödünçte',
	arizali: 'Arızalı',
	kayip: 'Kayıp',
};

export function isEnvanterDurum(value: unknown): value is EnvanterDurum {
	return typeof value === 'string' && (ENVANTER_DURUMLARI as readonly string[]).includes(value);
}

/** True when the item is on the shelf rather than lent out or out of service. */
export function isAvailable(status: string | null | undefined): boolean {
	return status === 'saglam';
}
