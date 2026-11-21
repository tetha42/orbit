import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool } from '@/db';
import { decryptSecret, encryptSecret } from '@/lib/auth/secretBox';
import type { FormField, FormFieldValueMap } from '@/lib/formFields';

export interface MemberFieldValue {
	fieldId: string;
	fieldKey: string;
	value: string;
}

export function parseCustomFieldsJson(raw: unknown): Record<string, string> {
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
