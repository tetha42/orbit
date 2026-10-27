import crypto from 'crypto';
import { deriveKey } from '@/lib/auth/serverSecret';
import {
	biletKoduMetni,
	yoklamaKoduMetni,
	yoklamaPenceresi,
	type BiletKodu,
	type YoklamaKodu,
} from '@/lib/events';

/**
 * Signed attendance codes.
 *
 * The projector code proves that whoever submits it could see the screen in the
 * last minute: it names the event and a 30-second window and carries an HMAC
 * only the server can make. A ticket code names an event and a member, so door
 * staff scanning it record that member — not themselves.
 */

async function sign(purpose: string, parts: string[]): Promise<string> {
	const key = await deriveKey(`attendance:${purpose}`);
	return crypto.createHmac('sha256', key).update(parts.join('\u0000')).digest('base64url').slice(0, 22);
}

function sameSignature(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function yoklamaKoduUret(etkinlikId: string, now = Date.now()): Promise<YoklamaKodu & { metin: string; kisaKod: string }> {
	const pencere = yoklamaPenceresi(now);
	const imza = await sign('qr', [etkinlikId, String(pencere)]);
	const kod = { etkinlikId, pencere, imza };
	return { ...kod, metin: yoklamaKoduMetni(kod), kisaKod: kisaKodUret(imza) };
}

/** Length of the typeable code shown under the projector QR. */
export const KISA_KOD_UZUNLUK = 6;

/**
 * The short code printed under the projector QR: 6 letters or digits, derived from
 * the window's signature, so it changes with the window and is typeable by a participant.
 * Only A–Z and 0–9 are used; the signature is base64url, so its `-`/`_` are mapped to letters.
 */
export function kisaKodUret(imza: string): string {
	const alnum = imza.replace(/[^A-Za-z0-9]/g, '');
	return alnum.slice(0, KISA_KOD_UZUNLUK).toUpperCase();
}

/**
 * Accepts a short code for the event's current or previous window. The short code
 * is only a prefix of a signature, so it is matched by recomputing both windows.
 */
export async function kisaKoduDogrula(etkinlikId: string, kisa: string, now = Date.now()): Promise<'gecerli' | 'suresi-doldu' | 'gecersiz'> {
	const aranan = kisa.trim().toUpperCase();
	if (!new RegExp(`^[A-Z0-9]{${KISA_KOD_UZUNLUK}}$`).test(aranan)) return 'gecersiz';
	const current = yoklamaPenceresi(now);
	// The current window is valid; the one before it is accepted too (rollover grace).
	// Any older window is a real code that has simply expired.
	for (const pencere of [current, current - 1]) {
		const imza = await sign('qr', [etkinlikId, String(pencere)]);
		if (kisaKodUret(imza) === aranan) return 'gecerli';
	}
	for (let back = 2; back <= 6; back++) {
		const imza = await sign('qr', [etkinlikId, String(current - back)]);
		if (kisaKodUret(imza) === aranan) return 'suresi-doldu';
	}
	return 'gecersiz';
}

export async function biletKoduUret(etkinlikId: string, userId: string): Promise<string> {
	return biletKoduMetni({ etkinlikId, userId, imza: await sign('bilet', [etkinlikId, userId]) });
}

export async function biletKoduDogrula(kod: BiletKodu): Promise<boolean> {
	return sameSignature(await sign('bilet', [kod.etkinlikId, kod.userId]), kod.imza);
}
