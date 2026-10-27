import crypto from 'crypto';
import type { Decision } from '@/db/schema';

/**
 * A short fingerprint of what a document says. Printed on the document and shown
 * on the public verification page, so a reader can tell a printed copy matches
 * the record — an edited printout produces a different value.
 */
export function belgeOzeti(t: Pick<Decision, 'kararNo' | 'baslik' | 'date' | 'icerik'>): string {
	const hex = crypto
		.createHash('sha256')
		.update([t.kararNo, t.baslik, t.date, t.icerik].join('\u0000'))
		.digest('hex')
		.toUpperCase();
	return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}
