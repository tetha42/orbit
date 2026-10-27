/**
 * Official document numbers are stored as `YYYYnnn` (e.g. 2026005 is the fifth
 * document of 2026). This turns them into the "2026/005" form printed on paper;
 * numbers outside that scheme are shown as they are.
 */
export function evrakSayisi(kararNo: number): string {
	const n = Math.trunc(Number(kararNo));
	if (!Number.isFinite(n) || n < 1000_000 || n > 9999_999) return String(Number.isFinite(n) ? n : '');
	return `${Math.floor(n / 1000)}/${String(n % 1000).padStart(3, '0')}`;
}

/** The verification code printed under a document's QR code. */
export const evrakDogrulamaKodu = (kararNo: number) => `ORBIT-DOC-${Math.trunc(Number(kararNo))}`;
