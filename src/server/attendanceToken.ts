import crypto from 'crypto';
import { deriveKey } from '@/lib/auth/serverSecret';
import {
	ticketCodeText,
	attendanceCodeText,
	attendanceWindow,
	type TicketCode,
	type AttendanceCode,
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

export async function createAttendanceCode(eventId: string, now = Date.now()): Promise<AttendanceCode & { text: string; shortCode: string }> {
	const windowIndex = attendanceWindow(now);
	const signature = await sign('qr', [eventId, String(windowIndex)]);
	const code = { eventId, window: windowIndex, signature: signature };
	return { ...code, text: attendanceCodeText(code), shortCode: createShortCode(signature) };
}

/** Length of the typeable code shown under the projector QR. */
export const SHORT_CODE_LENGTH = 6;

/**
 * The short code printed under the projector QR: 6 letters or digits, derived from
 * the window's signature, so it changes with the window and is typeable by a participant.
 * Only A–Z and 0–9 are used; the signature is base64url, so its `-`/`_` are mapped to letters.
 */
export function createShortCode(signature: string): string {
	const alnum = signature.replace(/[^A-Za-z0-9]/g, '');
	return alnum.slice(0, SHORT_CODE_LENGTH).toUpperCase();
}

/**
 * Accepts a short code for the event's current or previous window. The short code
 * is only a prefix of a signature, so it is matched by recomputing both windows.
 */
export async function verifyShortCode(eventId: string, short: string, now = Date.now()): Promise<'valid' | 'expired' | 'invalid'> {
	const searched = short.trim().toUpperCase();
	if (!new RegExp(`^[A-Z0-9]{${SHORT_CODE_LENGTH}}$`).test(searched)) return 'invalid';
	const current = attendanceWindow(now);
	// The current window is valid; the one before it is accepted too (rollover grace).
	// Any older window is a real code that has simply expired.
	for (const windowIndex of [current, current - 1]) {
		const signature = await sign('qr', [eventId, String(windowIndex)]);
		if (createShortCode(signature) === searched) return 'valid';
	}
	for (let back = 2; back <= 6; back++) {
		const signature = await sign('qr', [eventId, String(current - back)]);
		if (createShortCode(signature) === searched) return 'expired';
	}
	return 'invalid';
}

export async function createTicketCode(eventId: string, userId: string): Promise<string> {
	return ticketCodeText({ eventId, userId, signature: await sign('ticket', [eventId, userId]) });
}

export async function verifyTicketCode(code: TicketCode): Promise<boolean> {
	return sameSignature(await sign('ticket', [code.eventId, code.userId]), code.signature);
}
