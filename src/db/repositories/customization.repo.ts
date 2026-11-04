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
} from '@/server/customData';

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

interface LegalDocumentTranslations {
	tr?: { title?: string; body?: string };
	en?: { title?: string; body?: string };
	titleTr?: string;
	titleEn?: string;
	bodyTr?: string;
	bodyEn?: string;
}

function parseLegalTranslations(raw: unknown): {
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
} {
	let obj: LegalDocumentTranslations = {};
	if (typeof raw === 'string') {
		try {
			obj = JSON.parse(raw) as LegalDocumentTranslations;
		} catch {
			obj = {};
		}
	} else if (raw && typeof raw === 'object') {
		obj = raw as LegalDocumentTranslations;
	}
	return {
		titleTr: String(obj.tr?.title ?? obj.titleTr ?? ''),
		titleEn: String(obj.en?.title ?? obj.titleEn ?? ''),
		bodyTr: String(obj.tr?.body ?? obj.bodyTr ?? ''),
		bodyEn: String(obj.en?.body ?? obj.bodyEn ?? ''),
	};
}

function serializeLegalTranslations(input: {
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
}): string {
	return JSON.stringify({
		tr: { title: input.titleTr, body: input.bodyTr },
		en: { title: input.titleEn, body: input.bodyEn },
	});
}

function toLegalDocument(row: Record<string, unknown>): LegalDocument {
	const t = parseLegalTranslations(row.translations);
	return {
		id: String(row.id),
		docType: String(row.docType ?? row.doc_type) as LegalDocumentType,
		scope: String(row.scope) as LegalDocumentScope,
		titleTr: t.titleTr,
		titleEn: t.titleEn,
		bodyTr: t.bodyTr,
		bodyEn: t.bodyEn,
		required: Number(row.required) === 1,
		enabled: Number(row.enabled) === 1,
		sortOrder: Number(row.sortOrder ?? row.sort_order) || 0,
		version: Number(row.version) || 1,
		updatedAt: Number(row.updatedAt ?? row.updated_at) || 0,
		updatedBy: row.updatedBy ? String(row.updatedBy) : (row.updated_by ? String(row.updated_by) : null),
	};
}

async function seedLegalDocuments(): Promise<void> {
	const now = Date.now();
	for (const [index, doc] of DEFAULT_LEGAL_DOCUMENTS.entries()) {
		await getPgPool().query(
			`INSERT INTO legal_documents
				(id, doc_type, scope, translations, versions, required, enabled, sort_order, version, updated_at)
			 VALUES ($1, $2, $3, $4::jsonb, '[]'::jsonb, $5, 1, $6, 1, $7)
			 ON CONFLICT (doc_type) DO NOTHING`,
			[
				`legal_${doc.docType}`,
				doc.docType,
				doc.scope,
				serializeLegalTranslations(doc),
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
		`SELECT id, doc_type AS "docType", scope, translations, versions, required, enabled,
		        sort_order AS "sortOrder", version, updated_at AS "updatedAt", updated_by AS "updatedBy"
		 FROM legal_documents${where}
		 ORDER BY sort_order ASC, updated_at ASC`,
		params
	);
	return res.rows.map((row) => toLegalDocument(row));
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

function parseVersionsJson(raw: unknown): LegalDocumentVersion[] {
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
			docType: String(row.docType ?? ''),
			version: Number(row.version) || 1,
			scope: String(row.scope ?? 'registration'),
			titleTr: String(row.titleTr ?? ''),
			titleEn: String(row.titleEn ?? ''),
			bodyTr: String(row.bodyTr ?? ''),
			bodyEn: String(row.bodyEn ?? ''),
			required: Boolean(row.required),
			contentHash: String(row.contentHash ?? ''),
			archivedAt: Number(row.archivedAt) || 0,
			archivedBy: row.archivedBy ? String(row.archivedBy) : null,
		}));
}

/** Archived versions of one document, newest first. The current row is separate. */
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

function parseLegalConsents(raw: unknown): LegalAcceptance[] {
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
	translations?: unknown;
	options: string;
	required: number;
	enabled: number;
	sortOrder: number;
	archivedAt: number | null;
}

interface FormFieldTranslations {
	tr?: { label?: string; placeholder?: string };
	en?: { label?: string; placeholder?: string };
	section?: string;
	labelTr?: string;
	labelEn?: string;
	placeholderTr?: string;
	placeholderEn?: string;
}

function parseFieldTranslations(raw: unknown): {
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
} {
	let obj: FormFieldTranslations = {};
	if (typeof raw === 'string') {
		try {
			obj = JSON.parse(raw) as FormFieldTranslations;
		} catch {
			obj = {};
		}
	} else if (raw && typeof raw === 'object') {
		obj = raw as FormFieldTranslations;
	}
	return {
		section: String(obj.section ?? 'custom'),
		labelTr: String(obj.tr?.label ?? obj.labelTr ?? ''),
		labelEn: String(obj.en?.label ?? obj.labelEn ?? ''),
		placeholderTr: String(obj.tr?.placeholder ?? obj.placeholderTr ?? ''),
		placeholderEn: String(obj.en?.placeholder ?? obj.placeholderEn ?? ''),
	};
}

function serializeFieldTranslations(input: {
	section: string;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
}): string {
	return JSON.stringify({
		section: input.section || 'custom',
		tr: { label: input.labelTr, placeholder: input.placeholderTr },
		en: { label: input.labelEn, placeholder: input.placeholderEn },
	});
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
	const t = parseFieldTranslations(row.translations);
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
		section: t.section,
		labelTr: t.labelTr,
		labelEn: t.labelEn,
		placeholderTr: t.placeholderTr,
		placeholderEn: t.placeholderEn,
		options: parseOptions(row.options),
		required: Number(row.required) === 1,
		enabled: Number(row.enabled) === 1,
		sortOrder: Number(row.sortOrder) || 0,
		archivedAt: row.archivedAt ? Number(row.archivedAt) : null,
	};
}

const FORM_FIELD_COLUMNS = `id, scope, collect_at AS "collectAt", required_at AS "requiredAt",
	directory_visibility AS "directoryVisibility", self_editable AS "selfEditable",
	admin_editable AS "adminEditable", field_key AS "fieldKey", type, translations,
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
			 field_key, type, translations, options, required, enabled, sort_order, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $15)
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
			serializeFieldTranslations(input),
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
			self_editable = $6, admin_editable = $7, field_key = $8, type = $9,
			translations = $10::jsonb, options = $11, required = $12, enabled = $13,
			sort_order = $14, updated_at = $15
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
			serializeFieldTranslations(input),
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

function parseCustomFieldsJson(raw: unknown): Record<string, string> {
	if (!raw) return {};
	let obj: unknown = raw;
	if (typeof raw === 'string') {
		try {
			obj = JSON.parse(raw);
		} catch {
			return {};
		}
	}
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
		if (v !== undefined && v !== null) out[k] = String(v);
	}
	return out;
}

export async function getMemberFieldValues(
	userId: string,
	options?: { includeSecrets?: boolean }
): Promise<Record<string, string>> {
	await ensurePostgresInit();
	const [userRes, fieldsRes] = await Promise.all([
		getPgPool().query('SELECT custom_fields AS "customFields" FROM users WHERE id = $1', [userId]),
		getPgPool().query('SELECT field_key AS "fieldKey", type FROM form_fields'),
	]);
	if (!userRes.rows[0]) return {};
	const customFields = parseCustomFieldsJson(
		userRes.rows[0].customFields ?? userRes.rows[0].custom_fields
	);
	const typeByKey = new Map<string, string>(
		fieldsRes.rows.map((r) => [String(r.fieldKey ?? r.field_key), String(r.type)])
	);

	const out: Record<string, string> = {};
	for (const [fieldKey, raw] of Object.entries(customFields)) {
		const type = typeByKey.get(fieldKey) ?? 'text';
		if (type === 'password' && !options?.includeSecrets) {
			out[fieldKey] = '••••••••';
			continue;
		}
		if (type === 'password') {
			out[fieldKey] = (await decryptSecret(raw)) ?? '';
			continue;
		}
		out[fieldKey] = raw;
	}
	return out;
}

/** Stores custom values for a member in users.custom_fields JSONB, encrypting password-type fields at rest. */
export async function setMemberFieldValues(
	userId: string,
	values: FormFieldValueMap,
	fields: readonly FormField[],
	existingClient?: PoolClient
): Promise<void> {
	await ensurePostgresInit();
	const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
	const patch: Record<string, string> = {};
	for (const [key, value] of Object.entries(values)) {
		const field = byKey.get(key);
		if (!field) continue;
		patch[key] = field.type === 'password' ? await encryptSecret(value) : value;
	}
	if (Object.keys(patch).length === 0) return;

	const write = async (client: Pick<PoolClient, 'query'>) => {
		await client.query(
			`UPDATE users
			 SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $2::jsonb
			 WHERE id = $1`,
			[userId, JSON.stringify(patch)]
		);
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

const CUSTOM_WALLPAPERS_KEY = 'custom_wallpapers';

async function readStoredCustomWallpapers(): Promise<CustomWallpaper[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT value FROM system_settings WHERE key = $1`,
		[CUSTOM_WALLPAPERS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
			.map((row) => ({
				id: String(row.id ?? ''),
				titleTr: String(row.titleTr ?? ''),
				titleEn: String(row.titleEn ?? ''),
				type: String(row.type ?? 'custom'),
				filename: String(row.filename ?? ''),
				mime: String(row.mime ?? 'image/jpeg'),
				size: Number(row.size) || 0,
				createdBy: row.createdBy ? String(row.createdBy) : null,
				createdAt: Number(row.createdAt) || 0,
				sortOrder: Number(row.sortOrder) || 0,
			}));
	} catch {
		return [];
	}
}

async function writeStoredCustomWallpapers(list: CustomWallpaper[]): Promise<void> {
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[CUSTOM_WALLPAPERS_KEY, JSON.stringify(list), Date.now()]
	);
}

export async function getCustomWallpapers(): Promise<CustomWallpaper[]> {
	const list = await readStoredCustomWallpapers();
	return list
		.filter((row) =>
			existsSync(path.join(customAssetDir('wallpapers'), String(row.filename ?? '')))
		)
		.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
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
	const list = await readStoredCustomWallpapers();
	const now = Date.now();
	const id = `wp_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
	const maxOrder = list.reduce((max, item) => Math.max(max, item.sortOrder), 0);
	const created: CustomWallpaper = {
		id,
		titleTr: input.titleTr,
		titleEn: input.titleEn,
		type: input.type,
		filename: input.filename,
		mime: input.mime,
		size: input.size,
		createdBy: input.createdBy,
		createdAt: now,
		sortOrder: maxOrder + 1,
	};
	list.push(created);
	await writeStoredCustomWallpapers(list);
	return created;
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
	const list = await readStoredCustomWallpapers();
	const idx = list.findIndex((w) => w.id === id);
	if (idx === -1) return null;
	list[idx] = { ...list[idx], titleTr, titleEn };
	await writeStoredCustomWallpapers(list);
	return getCustomWallpaperById(id);
}

export async function deleteCustomWallpaper(id: string): Promise<CustomWallpaper | null> {
	const list = await readStoredCustomWallpapers();
	const idx = list.findIndex((w) => w.id === id);
	if (idx === -1) return null;
	const [removed] = list.splice(idx, 1);
	await writeStoredCustomWallpapers(list);
	return removed ?? null;
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
