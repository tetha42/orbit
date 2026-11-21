import type { Decision } from '@/db/schema';
import { computeDocumentDigestWasm } from '@/lib/wasm/securityEngine';

/**
 * A short fingerprint of what a document says. Printed on the document and shown
 * on the public verification page, so a reader can tell a printed copy matches
 * the record — an edited printout produces a different value.
 * Accelerated with the WASM engine.
 */
export function documentSummary(t: Pick<Decision, 'referenceNumber' | 'title' | 'date' | 'content'>): string {
	return computeDocumentDigestWasm(t.referenceNumber, t.title, t.date, t.content);
}
