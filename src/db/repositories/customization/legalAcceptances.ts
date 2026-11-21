import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import type { LegalDocumentType } from '@/lib/i18n/data/legalDefaults';
import {
	type LegalDocument,
	legalDocumentContentHash,
	getLegalDocuments,
} from './legalDocuments';

export interface LegalAcceptanceMeta {
	ip?: string | null;
	userAgent?: string | null;
	source?: 'registration' | 'account' | 'reconsent' | 'legacy';
}

export interface LegalAcceptance {
	id: string;
	documentId: string;
	docType: LegalDocumentType;
	documentVersion: number;
	contentHash: string;
	acceptedAt: number;
	ip: string | null;
	userAgent: string | null;
	source: string;
}

export function parseLegalConsents(raw: unknown): LegalAcceptance[] {
	let arr: unknown = raw;
	if (typeof raw === 'string') {
		try {
			arr = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(arr)) return [];
	return arr
		.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
		.map((row) => ({
			id: String(row.id ?? ''),
			documentId: String(row.documentId ?? ''),
			docType: String(row.docType ?? 'terms') as LegalDocumentType,
			documentVersion: Number(row.documentVersion) || 1,
			contentHash: String(row.contentHash ?? ''),
			acceptedAt: Number(row.acceptedAt) || 0,
			ip: row.ip ? String(row.ip) : null,
			userAgent: row.userAgent ? String(row.userAgent) : null,
			source: String(row.source ?? 'registration'),
		}));
}

/**
 * Records what a member accepted, against the current document version and text
 * hash, in users.legal_consents JSONB.
 */
export async function acceptLegalDocuments(
	userId: string,
	documents: readonly LegalDocument[],
	meta: LegalAcceptanceMeta = {}
): Promise<void> {
	if (!userId || documents.length === 0) return;
	await ensurePostgresInit();
	const now = Date.now();
	const client = await getPgPool().connect();
	try {
		await client.query('BEGIN');
		const res = await client.query(
			'SELECT legal_consents AS "legalConsents" FROM users WHERE id = $1 FOR UPDATE',
			[userId]
		);
		const consents = parseLegalConsents(res.rows[0]?.legalConsents ?? res.rows[0]?.legal_consents);
		for (const doc of documents) {
			const exists = consents.some(
				(c) => c.documentId === doc.id && c.documentVersion === doc.version
			);
			if (!exists) {
				consents.push({
					id: `la_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
					documentId: doc.id,
					docType: doc.docType,
					documentVersion: doc.version,
					contentHash: legalDocumentContentHash(doc),
					acceptedAt: now,
					ip: meta.ip ?? null,
					userAgent: meta.userAgent ?? null,
					source: meta.source ?? 'registration',
				});
			}
		}
		await client.query(
			'UPDATE users SET legal_consents = $2::jsonb WHERE id = $1',
			[userId, JSON.stringify(consents)]
		);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
	}
}

export async function getLegalAcceptances(userId: string): Promise<LegalAcceptance[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT legal_consents AS "legalConsents" FROM users WHERE id = $1',
		[userId]
	);
	if (!res.rows[0]) return [];
	const consents = parseLegalConsents(res.rows[0].legalConsents ?? res.rows[0].legal_consents);
	consents.sort((a, b) => b.acceptedAt - a.acceptedAt);
	return consents;
}

/**
 * Required documents whose current version/text hash the member has not accepted
 * yet. Empty means the member is up to date; used both for the Settings card and
 * for any future login gate.
 */
export async function getMissingLegalAcceptances(userId: string): Promise<LegalDocument[]> {
	const [documents, acceptances] = await Promise.all([
		getLegalDocuments({ enabledOnly: true }),
		getLegalAcceptances(userId),
	]);
	const accepted = new Set(
		acceptances.map((row) => `${row.documentId}\u0000${row.documentVersion}\u0000${row.contentHash}`)
	);
	return documents.filter(
		(doc) => doc.required && !accepted.has(`${doc.id}\u0000${doc.version}\u0000${legalDocumentContentHash(doc)}`)
	);
}
