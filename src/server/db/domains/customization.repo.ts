import { createHash, randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool } from '@/db';
import {
	DEFAULT_LEGAL_DOCUMENTS,
	type LegalDocumentScope,
	type LegalDocumentType,
} from '@/lib/legalDefaults';
import {
	MAX_FORM_FIELDS,
	type FormField,
	type FormFieldOption,
	type FormFieldScope,
	type FormFieldType,
	type FormFieldValueMap,
} from '@/lib/formFields';
import { decryptSecret, encryptSecret } from '@/lib/auth/secretBox';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	REGISTRATION_CORE_SETTINGS_KEY,
	normalizeRegistrationCoreConfig,
	type RegistrationCoreConfig,
} from '@/lib/registrationConfig';
import {
	DEFAULT_TEAM_CATEGORIES,
	TEAM_CATEGORIES_SETTINGS_KEY,
	normalizeTeamCategories,
} from '@/lib/teamCategories';
import { existsSync } from 'fs';
import path from 'path';
import {
	customAssetDir,
	customImageNameFromUrl,
	isSafeCustomImageName,
} from '@/lib/server/customData';

/* ==================== public identity ==================== */

export interface PublicIdentity {
	/** The application name is fixed by the product. */
	appName: 'Orbit';
	/** The studio that engineered the product; never editable. */
	studio: 'tetha42';
	siteName: string;
	siteShortName: string;
	descriptionTr: string;
	descriptionEn: string;
	domain: string;
	iconUrl: string | null;
	/** Changes on every icon or name edit; versions the PWA manifest URL. */
	brandVersion: string;
}

export async function getPublicIdentity(): Promise<PublicIdentity> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT key, value FROM system_settings WHERE key = ANY($1)`,
		[
			[
				'kulup_adi',
				'site_short_name',
				'site_description_tr',
				'site_description_en',
				'kulup_domain',
				'site_icon',
				'site_brand_version',
			],
		]
	);
	const map = Object.fromEntries(res.rows.map((row) => [String(row.key), String(row.value)]));
	const siteName = map.kulup_adi?.trim() || 'Orbit Community';
	// If the custom icon row exists but its file is gone (volume not mounted,
	// manual deletion), fall back to the bundled icon instead of a broken image.
	const storedIcon = map.site_icon?.trim() || null;
	const iconName = customImageNameFromUrl(storedIcon);
	const iconUrl =
		storedIcon && iconName && isSafeCustomImageName(iconName) &&
		existsSync(path.join(customAssetDir('identity'), iconName))
			? storedIcon
			: null;
	const storedBrandVersion = map.site_brand_version?.trim();
	const iconVersionFromUrl = storedIcon?.match(/[?&]v=([^&#]+)/)?.[1];
	return {
		appName: 'Orbit',
		studio: 'tetha42',
		siteName,
		siteShortName: map.site_short_name?.trim() || siteName.slice(0, 24),
		descriptionTr:
			map.site_description_tr?.trim() ||
			'Tetha42 tarafından geliştirilen kendi sunucunuzda barındırılan topluluk işletim sistemi.',
		descriptionEn:
			map.site_description_en?.trim() ||
			'Self-hosted community operating system engineered by tetha42.',
		domain: map.kulup_domain?.trim() || 'orbit.local',
		iconUrl,
		brandVersion: storedBrandVersion || iconVersionFromUrl || 'default',
	};
}

/* ==================== legal documents ==================== */

export interface LegalDocument {
	id: string;
	docType: LegalDocumentType;
	scope: LegalDocumentScope;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
	enabled: boolean;
	sortOrder: number;
	version: number;
	updatedAt: number;
	updatedBy: string | null;
}

interface LegalDocumentRow {
	id: string;
	docType: string;
	scope: string;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: number;
	enabled: number;
	sortOrder: number;
	version: number;
	updatedAt: number;
	updatedBy: string | null;
}

function toLegalDocument(row: LegalDocumentRow): LegalDocument {
	return {
		id: row.id,
		docType: row.docType as LegalDocumentType,
		scope: row.scope as LegalDocumentScope,
		titleTr: row.titleTr,
		titleEn: row.titleEn,
		bodyTr: row.bodyTr,
		bodyEn: row.bodyEn,
		required: Number(row.required) === 1,
		enabled: Number(row.enabled) === 1,
		sortOrder: Number(row.sortOrder) || 0,
		version: Number(row.version) || 1,
		updatedAt: Number(row.updatedAt) || 0,
		updatedBy: row.updatedBy ?? null,
	};
}

async function seedLegalDocuments(): Promise<void> {
	const now = Date.now();
	for (const [index, doc] of DEFAULT_LEGAL_DOCUMENTS.entries()) {
		await getPgPool().query(
			`INSERT INTO legal_documents
				(id, doc_type, scope, title_tr, title_en, body_tr, body_en, required, enabled, sort_order, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10)
			 ON CONFLICT (doc_type) DO NOTHING`,
			[
				`legal_${doc.docType}`,
				doc.docType,
				doc.scope,
				doc.titleTr,
				doc.titleEn,
				doc.bodyTr,
				doc.bodyEn,
				doc.required ? 1 : 0,
				index,
				now,
			]
		);
	}
}

export async function getLegalDocuments(options?: {
	enabledOnly?: boolean;
	forRegistration?: boolean;
}): Promise<LegalDocument[]> {
	await ensurePostgresInit();
	const count = await getPgPool().query('SELECT COUNT(*)::int AS count FROM legal_documents');
	if (Number(count.rows[0]?.count) === 0) await seedLegalDocuments();

	const params: unknown[] = [];
	let where = '';
	if (options?.enabledOnly) where += ' WHERE enabled = 1';
	if (options?.forRegistration) {
		where += where ? ' AND ' : ' WHERE ';
		where += "scope IN ('registration', 'all')";
	}
	const res = await getPgPool().query(
		`SELECT id, doc_type AS "docType", scope, title_tr AS "titleTr", title_en AS "titleEn",
		        body_tr AS "bodyTr", body_en AS "bodyEn", required, enabled,
		        sort_order AS "sortOrder", version, updated_at AS "updatedAt", updated_by AS "updatedBy"
		 FROM legal_documents${where}
		 ORDER BY sort_order ASC, updated_at ASC`,
		params
	);
	return res.rows.map((row) => toLegalDocument(row as LegalDocumentRow));
}

export interface LegalDocumentVersion {
	id: string;
	documentId: string;
	docType: string;
	version: number;
	scope: string;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
	contentHash: string;
	archivedAt: number;
	archivedBy: string | null;
}

/** Archived versions of one document, newest first. The current row is separate. */
export async function getLegalDocumentVersions(docType: string): Promise<LegalDocumentVersion[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, document_id AS "documentId", doc_type AS "docType", version, scope,
		        title_tr AS "titleTr", title_en AS "titleEn", body_tr AS "bodyTr", body_en AS "bodyEn",
		        required, content_hash AS "contentHash", archived_at AS "archivedAt",
		        archived_by AS "archivedBy"
		 FROM legal_document_versions
		 WHERE doc_type = $1
		 ORDER BY version DESC`,
		[docType]
	);
	return res.rows.map((row) => ({
		...row,
		version: Number(row.version) || 1,
		required: Number(row.required) === 1,
		archivedAt: Number(row.archivedAt) || 0,
	})) as LegalDocumentVersion[];
}

export interface LegalDocumentInput {
	id?: string;
	docType: LegalDocumentType;
	scope: LegalDocumentScope;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
	enabled: boolean;
	sortOrder: number;
	updatedBy?: string | null;
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
			title_tr: string;
			title_en: string;
			body_tr: string;
			body_en: string;
			required: number;
		}>(
			`SELECT id, version, scope, title_tr, title_en, body_tr, body_en, required
			 FROM legal_documents WHERE doc_type = $1 FOR UPDATE`,
			[input.docType]
		);
		const previous = existing.rows[0];
		const id = previous?.id ?? input.id?.trim() ?? `legal_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
		// Only a content change creates a new version. Toggling enabled/sort order is
		// metadata, not a new agreement the member must re-accept.
		const contentChanged =
			Boolean(previous) &&
			(previous.scope !== input.scope ||
				previous.title_tr !== input.titleTr ||
				previous.title_en !== input.titleEn ||
				previous.body_tr !== input.bodyTr ||
				previous.body_en !== input.bodyEn ||
				Number(previous.required) !== (input.required ? 1 : 0));
		const version = previous
			? contentChanged
				? Number(previous.version || 1) + 1
				: Number(previous.version || 1)
			: 1;

		// Keep the old text before overwriting it: acceptances refer to version and
		// content hash, so the evidence must remain reconstructable.
		if (previous && contentChanged) {
			await client.query(
				`INSERT INTO legal_document_versions
					(id, document_id, doc_type, version, scope, title_tr, title_en, body_tr, body_en,
					 required, content_hash, archived_at, archived_by)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
				 ON CONFLICT (document_id, version) DO NOTHING`,
				[
					`lv_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
					previous.id,
					input.docType,
					previous.version,
					previous.scope,
					previous.title_tr,
					previous.title_en,
					previous.body_tr,
					previous.body_en,
					previous.required,
					legalDocumentContentHash({
						docType: input.docType,
						scope: previous.scope as LegalDocumentScope,
						titleTr: previous.title_tr,
						titleEn: previous.title_en,
						bodyTr: previous.body_tr,
						bodyEn: previous.body_en,
						required: Number(previous.required) === 1,
						version: Number(previous.version) || 1,
					}),
					now,
					input.updatedBy ?? null,
				]
			);
		}

		await client.query(
			`INSERT INTO legal_documents
				(id, doc_type, scope, title_tr, title_en, body_tr, body_en, required, enabled, sort_order, version, updated_at, updated_by)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			 ON CONFLICT (doc_type) DO UPDATE SET
				scope = EXCLUDED.scope,
				title_tr = EXCLUDED.title_tr,
				title_en = EXCLUDED.title_en,
				body_tr = EXCLUDED.body_tr,
				body_en = EXCLUDED.body_en,
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
				input.titleTr,
				input.titleEn,
				input.bodyTr,
				input.bodyEn,
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

/** Stable fingerprint of the exact text a member accepted. */
export function legalDocumentContentHash(
	doc: Pick<LegalDocument, 'docType' | 'scope' | 'titleTr' | 'titleEn' | 'bodyTr' | 'bodyEn' | 'required' | 'version'>
): string {
	return createHash('sha256')
		.update(
			[
				doc.docType,
				doc.scope,
				doc.titleTr,
				doc.titleEn,
				doc.bodyTr,
				doc.bodyEn,
				doc.required ? '1' : '0',
				String(doc.version),
			].join('\u0000')
		)
		.digest('hex');
}

export interface LegalAcceptanceMeta {
	ip?: string | null;
	userAgent?: string | null;
	source?: 'registration' | 'account' | 'reconsent' | 'legacy';
}

/**
 * Records what a member accepted, against the current document version and text
 * hash. Acceptance rows are append-only: a later document version creates a new
 * row instead of rewriting the old evidence.
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
		for (const doc of documents) {
			await client.query(
				`INSERT INTO legal_acceptances
					(id, user_id, document_id, document_version, content_hash, accepted_at, ip, user_agent, source)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				 ON CONFLICT (user_id, document_id, document_version) DO NOTHING`,
				[
					`la_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
					userId,
					doc.id,
					doc.version,
					legalDocumentContentHash(doc),
					now,
					meta.ip ?? null,
					meta.userAgent ?? null,
					meta.source ?? 'registration',
				]
			);
		}
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
	}
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

export async function getLegalAcceptances(userId: string): Promise<LegalAcceptance[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT a.id, a.document_id AS "documentId", d.doc_type AS "docType",
		        a.document_version AS "documentVersion", a.content_hash AS "contentHash",
		        a.accepted_at AS "acceptedAt", a.ip, a.user_agent AS "userAgent", a.source
		 FROM legal_acceptances a
		 JOIN legal_documents d ON d.id = a.document_id
		 WHERE a.user_id = $1
		 ORDER BY a.accepted_at DESC`,
		[userId]
	);
	return res.rows.map((row) => ({
		id: String(row.id),
		documentId: String(row.documentId),
		docType: String(row.docType) as LegalDocumentType,
		documentVersion: Number(row.documentVersion) || 1,
		contentHash: String(row.contentHash),
		acceptedAt: Number(row.acceptedAt) || 0,
		ip: row.ip ? String(row.ip) : null,
		userAgent: row.userAgent ? String(row.userAgent) : null,
		source: String(row.source ?? 'registration'),
	}));
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

/* ==================== form fields ==================== */

export interface FormFieldRow {
	id: string;
	scope: string;
	collectAt: string;
	requiredAt: string;
	directoryVisibility: string;
	selfEditable: number;
	adminEditable: number;
	fieldKey: string;
	type: string;
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
	options: string;
	required: number;
	enabled: number;
	sortOrder: number;
	archivedAt: number | null;
}

function parseOptions(raw: string): FormFieldOption[] {
	try {
		const parsed = JSON.parse(raw || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function toFormField(row: FormFieldRow): FormField {
	return {
		id: row.id,
		scope: row.scope as FormFieldScope,
		collectAt: row.collectAt as FormField['collectAt'],
		requiredAt: row.requiredAt as FormField['requiredAt'],
		directoryVisibility: row.directoryVisibility as FormField['directoryVisibility'],
		selfEditable: Number(row.selfEditable) === 1,
		adminEditable: Number(row.adminEditable) === 1,
		fieldKey: row.fieldKey,
		type: row.type as FormFieldType,
		section: row.section,
		labelTr: row.labelTr,
		labelEn: row.labelEn,
		placeholderTr: row.placeholderTr ?? '',
		placeholderEn: row.placeholderEn ?? '',
		options: parseOptions(row.options),
		required: Number(row.required) === 1,
		enabled: Number(row.enabled) === 1,
		sortOrder: Number(row.sortOrder) || 0,
		archivedAt: row.archivedAt ? Number(row.archivedAt) : null,
	};
}

const FORM_FIELD_COLUMNS = `id, scope, collect_at AS "collectAt", required_at AS "requiredAt",
	directory_visibility AS "directoryVisibility", self_editable AS "selfEditable",
	admin_editable AS "adminEditable", field_key AS "fieldKey", type, section,
	label_tr AS "labelTr", label_en AS "labelEn",
	placeholder_tr AS "placeholderTr", placeholder_en AS "placeholderEn",
	options, required, enabled, sort_order AS "sortOrder", archived_at AS "archivedAt"`;

export async function getFormFields(options?: {
	scope?: 'registration' | 'member' | 'directory' | 'profile';
	enabledOnly?: boolean;
	includeDisabled?: boolean;
	includeArchived?: boolean;
	isManager?: boolean;
}): Promise<FormField[]> {
	await ensurePostgresInit();
	const conditions: string[] = [];
	const params: unknown[] = [];
	if (!options?.includeArchived) conditions.push('archived_at IS NULL');
	if (options?.enabledOnly) conditions.push('enabled = 1');
	if (options?.scope) {
		if (options.scope === 'directory') {
			conditions.push('enabled = 1');
			if (!options.isManager) {
				conditions.push("directory_visibility = 'members'");
			}
		} else if (options.scope === 'profile') {
			conditions.push('self_editable = 1 AND enabled = 1');
		} else {
			const target = options.scope === 'member' ? 'admin' : 'registration';
			params.push(target);
			conditions.push(`(collect_at = $${params.length} OR collect_at = 'both')`);
		}
	}
	const uniqueConditions = Array.from(new Set(conditions));
	const where = uniqueConditions.length ? ` WHERE ${uniqueConditions.join(' AND ')}` : '';
	const res = await getPgPool().query(
		`SELECT ${FORM_FIELD_COLUMNS} FROM form_fields${where} ORDER BY sort_order ASC, created_at ASC`,
		params
	);
	return res.rows.map((row) => toFormField(row as FormFieldRow));
}

export interface FormFieldInput {
	id?: string;
	scope: FormFieldScope;
	collectAt: FormField['collectAt'];
	requiredAt: FormField['requiredAt'];
	directoryVisibility: FormField['directoryVisibility'];
	selfEditable: boolean;
	adminEditable: boolean;
	fieldKey: string;
	type: FormFieldType;
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
	options: FormFieldOption[];
	required: boolean;
	enabled: boolean;
	sortOrder: number;
}

export async function createFormField(input: FormFieldInput): Promise<FormField> {
	await ensurePostgresInit();
	const existing = await getPgPool().query(
		`SELECT COUNT(*)::int AS count FROM form_fields WHERE collect_at = $1 AND archived_at IS NULL`,
		[input.collectAt]
	);
	if (Number(existing.rows[0]?.count) >= MAX_FORM_FIELDS) {
		throw new Error(`A form can have at most ${MAX_FORM_FIELDS} custom fields.`);
	}
	const now = Date.now();
	const id = `ff_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
	const res = await getPgPool().query(
		`INSERT INTO form_fields
			(id, scope, collect_at, required_at, directory_visibility, self_editable, admin_editable,
			 field_key, type, section, label_tr, label_en, placeholder_tr, placeholder_en,
			 options, required, enabled, sort_order, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)
		 RETURNING ${FORM_FIELD_COLUMNS}`,
		[
			id,
			input.scope,
			input.collectAt,
			input.requiredAt,
			input.directoryVisibility,
			input.selfEditable ? 1 : 0,
			input.adminEditable ? 1 : 0,
			input.fieldKey,
			input.type,
			input.section,
			input.labelTr,
			input.labelEn,
			input.placeholderTr,
			input.placeholderEn,
			JSON.stringify(input.options),
			input.required ? 1 : 0,
			input.enabled ? 1 : 0,
			input.sortOrder,
			now,
		]
	);
	return toFormField(res.rows[0] as FormFieldRow);
}

export async function updateFormField(input: FormFieldInput & { id: string }): Promise<FormField | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE form_fields SET
			scope = $2, collect_at = $3, required_at = $4, directory_visibility = $5,
			self_editable = $6, admin_editable = $7, field_key = $8, type = $9, section = $10,
			label_tr = $11, label_en = $12, placeholder_tr = $13, placeholder_en = $14,
			options = $15, required = $16, enabled = $17, sort_order = $18, updated_at = $19
		 WHERE id = $1
		 RETURNING ${FORM_FIELD_COLUMNS}`,
		[
			input.id,
			input.scope,
			input.collectAt,
			input.requiredAt,
			input.directoryVisibility,
			input.selfEditable ? 1 : 0,
			input.adminEditable ? 1 : 0,
			input.fieldKey,
			input.type,
			input.section,
			input.labelTr,
			input.labelEn,
			input.placeholderTr,
			input.placeholderEn,
			JSON.stringify(input.options),
			input.required ? 1 : 0,
			input.enabled ? 1 : 0,
			input.sortOrder,
			Date.now(),
		]
	);
	return res.rows[0] ? toFormField(res.rows[0] as FormFieldRow) : null;
}

/** Soft-delete: the definition is archived, values stay available to managers. */
export async function deleteFormField(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const now = Date.now();
	const res = await getPgPool().query(
		`UPDATE form_fields
		 SET archived_at = $2, enabled = 0, updated_at = $2
		 WHERE id = $1 AND archived_at IS NULL`,
		[id, now]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function reorderFormFields(ids: string[]): Promise<void> {
	await ensurePostgresInit();
	const now = Date.now();
	const client = await getPgPool().connect();
	try {
		await client.query('BEGIN');
		for (const [index, id] of ids.entries()) {
			await client.query('UPDATE form_fields SET sort_order = $1, updated_at = $2 WHERE id = $3', [
				index,
				now,
				id,
			]);
		}
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

/* ==================== member custom values ==================== */

export interface MemberFieldValue {
	fieldId: string;
	fieldKey: string;
	value: string;
}

export async function getMemberFieldValues(
	userId: string,
	options?: { includeSecrets?: boolean }
): Promise<Record<string, string>> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT v.field_id AS "fieldId", f.field_key AS "fieldKey", f.type AS "type", v.value
		 FROM member_field_values v
		 JOIN form_fields f ON f.id = v.field_id
		 WHERE v.user_id = $1`,
		[userId]
	);
	const out: Record<string, string> = {};
	for (const row of res.rows) {
		const type = String(row.type);
		const raw = String(row.value);
		if (type === 'password' && !options?.includeSecrets) {
			out[String(row.fieldKey)] = '••••••••';
			continue;
		}
		if (type === 'password') {
			out[String(row.fieldKey)] = (await decryptSecret(raw)) ?? '';
			continue;
		}
		out[String(row.fieldKey)] = raw;
	}
	return out;
}

/** Stores custom values for a member, encrypting password-type fields at rest. */
export async function setMemberFieldValues(
	userId: string,
	values: FormFieldValueMap,
	fields: readonly FormField[],
	existingClient?: PoolClient
): Promise<void> {
	await ensurePostgresInit();
	const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
	const now = Date.now();

	const write = async (client: Pick<PoolClient, 'query'>) => {
		for (const [key, value] of Object.entries(values)) {
			const field = byKey.get(key);
			if (!field) continue;
			const stored = field.type === 'password' ? await encryptSecret(value) : value;
			await client.query(
				`INSERT INTO member_field_values (user_id, field_id, value, updated_at)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (user_id, field_id) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
				[userId, field.id, stored, now]
			);
		}
	};

	if (existingClient) {
		await write(existingClient);
		return;
	}

	const client = await getPgPool().connect();
	try {
		await client.query('BEGIN');
		await write(client);
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

/* ==================== custom wallpapers ==================== */

export interface CustomWallpaper {
	id: string;
	titleTr: string;
	titleEn: string;
	type: string;
	filename: string;
	mime: string;
	size: number;
	createdBy: string | null;
	createdAt: number;
	sortOrder: number;
}

const WALLPAPER_COLUMNS = `id, title_tr AS "titleTr", title_en AS "titleEn", type, filename, mime,
	size, created_by AS "createdBy", created_at AS "createdAt", sort_order AS "sortOrder"`;

export async function getCustomWallpapers(): Promise<CustomWallpaper[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${WALLPAPER_COLUMNS} FROM custom_wallpapers ORDER BY sort_order ASC, created_at ASC`
	);
	return res.rows
		.filter((row) =>
			existsSync(path.join(customAssetDir('wallpapers'), String(row.filename ?? '')))
		)
		.map((row) => ({
		id: String(row.id),
		titleTr: String(row.titleTr),
		titleEn: String(row.titleEn),
		type: String(row.type ?? 'custom'),
		filename: String(row.filename),
		mime: String(row.mime),
		size: Number(row.size) || 0,
		createdBy: row.createdBy ? String(row.createdBy) : null,
		createdAt: Number(row.createdAt) || 0,
		sortOrder: Number(row.sortOrder) || 0,
	}));
}

export async function createCustomWallpaper(input: {
	titleTr: string;
	titleEn: string;
	type: string;
	filename: string;
	mime: string;
	size: number;
	createdBy: string;
}): Promise<CustomWallpaper> {
	await ensurePostgresInit();
	const now = Date.now();
	const id = `wp_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
	const order = await getPgPool().query(
		'SELECT COALESCE(MAX(sort_order), 0)::int AS max FROM custom_wallpapers'
	);
	const res = await getPgPool().query(
		`INSERT INTO custom_wallpapers
			(id, title_tr, title_en, type, filename, mime, size, created_by, created_at, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING ${WALLPAPER_COLUMNS}`,
		[
			id,
			input.titleTr,
			input.titleEn,
			input.type,
			input.filename,
			input.mime,
			input.size,
			input.createdBy,
			now,
			Number(order.rows[0]?.max ?? 0) + 1,
		]
	);
	const row = res.rows[0];
	return {
		id: String(row.id),
		titleTr: String(row.titleTr),
		titleEn: String(row.titleEn),
		type: String(row.type),
		filename: String(row.filename),
		mime: String(row.mime),
		size: Number(row.size) || 0,
		createdBy: row.createdBy ? String(row.createdBy) : null,
		createdAt: Number(row.createdAt) || 0,
		sortOrder: Number(row.sortOrder) || 0,
	};
}

export async function getCustomWallpaperById(id: string): Promise<CustomWallpaper | null> {
	const all = await getCustomWallpapers();
	return all.find((wallpaper) => wallpaper.id === id) ?? null;
}

export async function renameCustomWallpaper(
	id: string,
	titleTr: string,
	titleEn: string
): Promise<CustomWallpaper | null> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE custom_wallpapers SET title_tr = $2, title_en = $3 WHERE id = $1', [
		id,
		titleTr,
		titleEn,
	]);
	return getCustomWallpaperById(id);
}

export async function deleteCustomWallpaper(id: string): Promise<CustomWallpaper | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`DELETE FROM custom_wallpapers WHERE id = $1 RETURNING ${WALLPAPER_COLUMNS}`,
		[id]
	);
	const row = res.rows[0];
	if (!row) return null;
	return {
		id: String(row.id),
		titleTr: String(row.titleTr),
		titleEn: String(row.titleEn),
		type: String(row.type),
		filename: String(row.filename),
		mime: String(row.mime),
		size: Number(row.size) || 0,
		createdBy: row.createdBy ? String(row.createdBy) : null,
		createdAt: Number(row.createdAt) || 0,
		sortOrder: Number(row.sortOrder) || 0,
	};
}

/* ==================== built-in wallpaper overrides ==================== */

export interface WallpaperOverride {
	titleTr?: string;
	titleEn?: string;
	hidden?: boolean;
}

const WALLPAPER_OVERRIDES_KEY = 'wallpaper_overrides';

/**
 * Operator overrides for the compile-time wallpaper catalogue. The defaults are
 * never mutated: a row here only records a renamed title or a hidden built-in,
 * so a fresh image or a factory reset falls back to the bundled catalogue.
 */
export async function getWallpaperOverrides(): Promise<Record<string, WallpaperOverride>> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[WALLPAPER_OVERRIDES_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, WallpaperOverride>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export async function setWallpaperOverride(
	id: string,
	patch: WallpaperOverride
): Promise<Record<string, WallpaperOverride>> {
	await ensurePostgresInit();
	const overrides = await getWallpaperOverrides();
	overrides[id] = { ...(overrides[id] ?? {}), ...patch };
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[WALLPAPER_OVERRIDES_KEY, JSON.stringify(overrides), Date.now()]
	);
	return overrides;
}

export async function clearWallpaperOverride(id: string): Promise<Record<string, WallpaperOverride>> {
	await ensurePostgresInit();
	const overrides = await getWallpaperOverrides();
	delete overrides[id];
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[WALLPAPER_OVERRIDES_KEY, JSON.stringify(overrides), Date.now()]
	);
	return overrides;
}

/* ==================== registration core fields ==================== */

/**
 * Track and experience-level presentation are stored as one JSON setting. The
 * registration form, add-member sheet, and the public registration-config API
 * all read this single source, so a label or option is never defined twice.
 */
export async function getRegistrationCoreConfig(): Promise<RegistrationCoreConfig> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[REGISTRATION_CORE_SETTINGS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_REGISTRATION_CORE_CONFIG;
	try {
		return normalizeRegistrationCoreConfig(JSON.parse(raw));
	} catch {
		return DEFAULT_REGISTRATION_CORE_CONFIG;
	}
}

export async function setRegistrationCoreConfig(input: unknown): Promise<RegistrationCoreConfig> {
	await ensurePostgresInit();
	const config = normalizeRegistrationCoreConfig(input);
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[REGISTRATION_CORE_SETTINGS_KEY, JSON.stringify(config), Date.now()]
	);
	return config;
}

/* ==================== team categories ==================== */

export async function getTeamCategories(): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[TEAM_CATEGORIES_SETTINGS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return [...DEFAULT_TEAM_CATEGORIES];
	try {
		return normalizeTeamCategories(JSON.parse(raw));
	} catch {
		return [...DEFAULT_TEAM_CATEGORIES];
	}
}

export async function setTeamCategories(input: unknown): Promise<string[]> {
	await ensurePostgresInit();
	const categories = normalizeTeamCategories(input);
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[TEAM_CATEGORIES_SETTINGS_KEY, JSON.stringify(categories), Date.now()]
	);
	return categories;
}

/**
 * Materialises the factory defaults that the rest of the app would otherwise
 * read from in-code fallbacks. Setup calls this once, with ON CONFLICT DO
 * NOTHING, so a planted default can never overwrite an operator's value.
 */
export async function seedSetupDefaults(communityName: string): Promise<void> {
	await ensurePostgresInit();
	const now = Date.now();
	const defaults: Record<string, string> = {
		site_short_name: communityName.trim().slice(0, 24) || 'Orbit',
		site_description_tr:
			'Tetha42 tarafından geliştirilen kendi sunucunuzda barındırılan topluluk işletim sistemi.',
		site_description_en: 'Self-hosted community operating system engineered by tetha42.',
		site_brand_version: 'default',
		[REGISTRATION_CORE_SETTINGS_KEY]: JSON.stringify(DEFAULT_REGISTRATION_CORE_CONFIG),
		[TEAM_CATEGORIES_SETTINGS_KEY]: JSON.stringify(DEFAULT_TEAM_CATEGORIES),
	};
	for (const [key, value] of Object.entries(defaults)) {
		await getPgPool().query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO NOTHING`,
			[key, value, now]
		);
	}
}
