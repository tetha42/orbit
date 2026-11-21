import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import {
	type LegalDocumentScope,
} from '@/lib/i18n/data/legalDefaults';
import {
	type LegalDocument,
	type LegalDocumentInput,
	type LegalDocumentVersion,
	toLegalDocument,
	parseLegalTranslations,
	serializeLegalTranslations,
	parseVersionsJson,
	legalDocumentContentHash,
} from './legalDocumentHelpers';
import { seedLegalDocuments } from './legalSeed';

export * from './legalDocumentHelpers';
export * from './legalSeed';

export async function getLegalDocuments(options?: {
	scope?: 'registration' | 'event' | 'all';
	enabledOnly?: boolean;
	forRegistration?: boolean;
}): Promise<LegalDocument[]> {
	await ensurePostgresInit();
	const conditions: string[] = [];
	const params: unknown[] = [];
	if (options?.enabledOnly) conditions.push('enabled = 1');
	const targetScope = options?.forRegistration ? 'registration' : options?.scope;
	if (targetScope && targetScope !== 'all') {
		params.push(targetScope);
		conditions.push(`scope = $${params.length}`);
	}
	const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
	const pool = getPgPool();
	let res = await pool.query(
		`SELECT id, doc_type, scope, translations, required, enabled, sort_order, version, updated_at, updated_by
		 FROM legal_documents${where} ORDER BY sort_order ASC, doc_type ASC`,
		params
	);
	if (res.rows.length === 0 && (!options?.scope || options.scope === 'all')) {
		await seedLegalDocuments();
		res = await pool.query(
			`SELECT id, doc_type, scope, translations, required, enabled, sort_order, version, updated_at, updated_by
			 FROM legal_documents ORDER BY sort_order ASC, doc_type ASC`
		);
	}
	return res.rows.map((row) => toLegalDocument(row));
}

export async function getLegalDocumentByType(docType: string): Promise<LegalDocument | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, doc_type, scope, translations, required, enabled, sort_order, version, updated_at, updated_by
		 FROM legal_documents WHERE doc_type = $1 LIMIT 1`,
		[docType]
	);
	return res.rows[0] ? toLegalDocument(res.rows[0]) : null;
}

export async function getLegalDocumentVersions(docType: string): Promise<LegalDocumentVersion[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT versions FROM legal_documents WHERE doc_type = $1 LIMIT 1`,
		[docType]
	);
	if (!res.rows[0]) return [];
	const versions = parseVersionsJson(res.rows[0].versions);
	versions.sort((a, b) => b.version - a.version);
	return versions;
}

export async function upsertLegalDocument(input: LegalDocumentInput): Promise<LegalDocument> {
	await ensurePostgresInit();
	const now = Date.now();
	const pool = getPgPool();
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const existing = await client.query<{
			id: string;
			version: number;
			scope: string;
			translations: unknown;
			versions: unknown;
			required: number;
		}>(
			`SELECT id, version, scope, translations, versions, required
			 FROM legal_documents WHERE doc_type = $1 FOR UPDATE`,
			[input.docType]
		);
		const previous = existing.rows[0];
		const id = previous?.id ?? input.id?.trim() ?? `legal_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
		const prevText = previous ? parseLegalTranslations(previous.translations) : null;
		const contentChanged =
			Boolean(previous && prevText) &&
			(previous.scope !== input.scope ||
				prevText!.titleTr !== input.titleTr ||
				prevText!.titleEn !== input.titleEn ||
				prevText!.bodyTr !== input.bodyTr ||
				prevText!.bodyEn !== input.bodyEn ||
				Number(previous.required) !== (input.required ? 1 : 0));
		const version = previous
			? contentChanged
				? Number(previous.version || 1) + 1
				: Number(previous.version || 1)
			: 1;

		const versions = previous ? parseVersionsJson(previous.versions) : [];
		if (previous && prevText && contentChanged) {
			const prevVersion = Number(previous.version) || 1;
			if (!versions.some((v) => v.version === prevVersion)) {
				versions.unshift({
					id: `lv_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
					documentId: previous.id,
					docType: input.docType,
					version: prevVersion,
					scope: previous.scope,
					titleTr: prevText.titleTr,
					titleEn: prevText.titleEn,
					bodyTr: prevText.bodyTr,
					bodyEn: prevText.bodyEn,
					required: Number(previous.required) === 1,
					contentHash: legalDocumentContentHash({
						docType: input.docType,
						scope: previous.scope as LegalDocumentScope,
						titleTr: prevText.titleTr,
						titleEn: prevText.titleEn,
						bodyTr: prevText.bodyTr,
						bodyEn: prevText.bodyEn,
						required: Number(previous.required) === 1,
						version: prevVersion,
					}),
					archivedAt: now,
					archivedBy: input.updatedBy ?? null,
				});
			}
		}

		await client.query(
			`INSERT INTO legal_documents
				(id, doc_type, scope, translations, versions, required, enabled, sort_order, version, updated_at, updated_by)
			 VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11)
			 ON CONFLICT (doc_type) DO UPDATE SET
				scope = EXCLUDED.scope,
				translations = EXCLUDED.translations,
				versions = EXCLUDED.versions,
				required = EXCLUDED.required,
				enabled = EXCLUDED.enabled,
				sort_order = EXCLUDED.sort_order,
				version = EXCLUDED.version,
				updated_at = EXCLUDED.updated_at,
				updated_by = EXCLUDED.updated_by`,
			[
				id,
				input.docType,
				input.scope,
				serializeLegalTranslations(input),
				JSON.stringify(versions),
				input.required ? 1 : 0,
				input.enabled ? 1 : 0,
				input.sortOrder,
				version,
				now,
				input.updatedBy ?? null,
			]
		);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
	}

	const fresh = await getLegalDocuments();
	const saved = fresh.find((doc) => doc.docType === input.docType);
	if (!saved) throw new Error('Legal document could not be saved.');
	return saved;
}
