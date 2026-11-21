import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import {
	MAX_FORM_FIELDS,
	type FormField,
	type FormFieldOption,
	type FormFieldScope,
	type FormFieldType,
} from '@/lib/formFields';
import {
	toFormField,
	serializeFieldTranslations,
	type FormFieldRow,
} from './formFieldHelpers';

export * from './formFieldHelpers';

export const FORM_FIELD_COLUMNS = `id, scope, collect_at AS "collectAt", required_at AS "requiredAt",
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
