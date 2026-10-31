import type { User } from '@/db/schema';
import {
	getFormFields,
	getMemberFieldValues,
	getRegistrationCoreConfig,
	getUserById,
	setMemberFieldValues,
	withTransaction,
} from '@/db';
import { publishEvent } from '@/db/olaylar';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { getRolePermission } from '@/db/roles';
import { alanFarki, memberTargetName } from '@/lib/audit';
import { isValidEmail } from '@/lib/mail/address';
import { BIO_MAX } from '@/lib/profile';
import {
	validateAdminEditValues,
	validateSelfEditValues,
	type FormField,
	type FormFieldValueMap,
} from '@/lib/formFields';
import { defaultTrackValue } from '@/lib/registrationConfig';

export interface MemberAdminMember {
	id: string;
	ad: string;
	soyad: string;
	email: string;
	ogrenciNo: string;
	bolum: string;
	sinif: number;
	bio: string;
	profilFoto: string | null;
	status: User['status'];
	roleId: string | null;
	rolBilgi: { id: string; ad: string; renk: string } | null;
}

export interface MemberAdminDetail {
	member: MemberAdminMember;
	fields: FormField[];
	customFields: FormFieldValueMap;
	core: Awaited<ReturnType<typeof getRegistrationCoreConfig>>;
}

export type MemberUpdateResult =
	| { ok: true; detail: MemberAdminDetail }
	| { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

function hasUnsafeTextChars(value: string): boolean {
	return /[<>]|\p{Cc}/u.test(value);
}

function safeMember(user: User, role: MemberAdminMember['rolBilgi']): MemberAdminMember {
	return {
		id: user.id,
		ad: user.ad,
		soyad: user.soyad,
		email: user.email,
		ogrenciNo: user.ogrenciNo ?? '',
		bolum: user.bolum,
		sinif: Number(user.sinif) || 1,
		bio: user.bio ?? '',
		profilFoto: user.profilFoto ?? null,
		status: user.status,
		roleId: user.roleId ?? null,
		rolBilgi: role,
	};
}

export async function getMemberAdminDetail(id: string): Promise<MemberAdminDetail | null> {
	const user = await getUserById(id);
	if (!user) return null;
	const [role, allFields, values, core] = await Promise.all([
		user.roleId ? getRolePermission(user.roleId) : Promise.resolve(null),
		getFormFields({ includeArchived: false }),
		getMemberFieldValues(id),
		getRegistrationCoreConfig(),
	]);
	const fields = allFields.filter(
		(field) => field.enabled && field.adminEditable && field.type !== 'password'
	);
	const keys = new Set(fields.map((field) => field.fieldKey));
	const customFields: FormFieldValueMap = {};
	for (const [key, value] of Object.entries(values)) {
		if (keys.has(key)) customFields[key] = value;
	}
	return {
		member: safeMember(user, role?.role ?? null),
		fields,
		customFields,
		core,
	};
}

function readString(raw: unknown, fallback = ''): string {
	return typeof raw === 'string' ? raw.trim() : fallback;
}

/**
 * Admin profile edit. Every write happens in one transaction; the audit record
 * contains only the fields that actually changed.
 */
export async function updateMemberForAdmin(
	id: string,
	input: Record<string, unknown>,
	ctx: AuditContext
): Promise<MemberUpdateResult> {
	const target = await getUserById(id);
	if (!target) return { ok: false, status: 404, error: 'Üye bulunamadı.' };

	const [core, fields] = await Promise.all([
		getRegistrationCoreConfig(),
		getFormFields({ includeArchived: false }),
	]);

	const ad = readString(input.ad, target.ad);
	const soyad = readString(input.soyad, target.soyad);
	const email = readString(input.email, target.email).toLowerCase();
	const handle = readString(input.ogrenciNo, target.ogrenciNo ?? '');
	const bolum = readString(input.bolum, target.bolum) || defaultTrackValue(core);
	const rawLevel = input.sinif === undefined ? target.sinif : Number(input.sinif);
	const bio = input.bio === undefined ? target.bio ?? '' : readString(input.bio);

	if (
		ad.length < 2 ||
		ad.length > 60 ||
		soyad.length < 2 ||
		soyad.length > 60 ||
		hasUnsafeTextChars(ad) ||
		hasUnsafeTextChars(soyad) ||
		hasUnsafeTextChars(bolum)
	) {
		return { ok: false, status: 400, error: 'Ad, soyad veya topluluk alanı geçersiz.' };
	}
	if (!handle || !/^[a-zA-Z0-9_-]{3,32}$/.test(handle)) {
		return {
			ok: false,
			status: 400,
			error: 'Üye Kimliği / Kullanıcı Adı 3–32 karakter olmalı; harf, sayı, tire ve alt çizgi kullanın.',
		};
	}
	if (!isValidEmail(email)) {
		return { ok: false, status: 400, error: 'Geçerli bir e-posta adresi girin.' };
	}
	if (bio.length > BIO_MAX) {
		return { ok: false, status: 400, error: `Biyografi en fazla ${BIO_MAX} karakter olabilir.` };
	}

	const allowedTracks = new Set(core.track.options.map((option) => option.value));
	if (bolum !== target.bolum && !allowedTracks.has(bolum)) {
		return { ok: false, status: 400, error: 'Listeden bir topluluk alanı seçin.' };
	}
	const allowedLevels = new Set(core.level.options.map((option) => Number(option.value)));
	const level = Number(rawLevel);
	if (!Number.isInteger(level) || (level !== target.sinif && !allowedLevels.has(level))) {
		return { ok: false, status: 400, error: 'Geçerli bir deneyim seviyesi seçin.' };
	}

	const customValidation = validateAdminEditValues(fields, input.customFields);
	if (!customValidation.ok) {
		return {
			ok: false,
			status: 400,
			error: 'Lütfen işaretli alanları düzeltin.',
			fieldErrors: customValidation.errors,
		};
	}

	await withTransaction(async (client) => {
		const currentRes = await client.query(
			`SELECT first_name, last_name, email, handle, department, grade, bio, avatar_url, role_id, status
			 FROM users WHERE id = $1 FOR UPDATE`,
			[id]
		);
		const current = currentRes.rows[0];
		if (!current) throw new Error('MEMBER_NOT_FOUND');

		const emailTaken = await client.query(
			'SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1',
			[email, id]
		);
		if (emailTaken.rowCount) throw new Error('EMAIL_TAKEN');

		const handleTaken = await client.query(
			'SELECT id FROM users WHERE handle = $1 AND id <> $2 LIMIT 1',
			[handle, id]
		);
		if (handleTaken.rowCount) throw new Error('HANDLE_TAKEN');

		const submitted = input.customFields && typeof input.customFields === 'object'
			? (input.customFields as Record<string, unknown>)
			: {};

		const beforeValuesRes = await client.query(
			`SELECT f.field_key AS "fieldKey", v.value
			 FROM member_field_values v
			 JOIN form_fields f ON f.id = v.field_id
			 WHERE v.user_id = $1`,
			[id]
		);
		const beforeCustom: FormFieldValueMap = {};
		const editableKeys = new Set(fields.map((field) => field.fieldKey));
		for (const row of beforeValuesRes.rows) {
			const key = String(row.fieldKey);
			if (!editableKeys.has(key)) continue;
			beforeCustom[key] = String(row.value ?? '');
		}

		await client.query(
			`UPDATE users SET
				first_name = $2, last_name = $3, email = $4, handle = $5,
				department = $6, grade = $7, bio = $8
			 WHERE id = $1`,
			[id, ad, soyad, email, handle, bolum, level, bio || null]
		);

		await setMemberFieldValues(id, customValidation.clean, fields, client);

		// An optional value the manager cleared must actually disappear, not be
		// silently left behind by the upsert.
		for (const field of fields) {
			if (!field.adminEditable) continue;
			const raw = submitted[field.fieldKey];
			if (typeof raw === 'string' && raw.trim() === '') {
				await client.query(
					'DELETE FROM member_field_values WHERE user_id = $1 AND field_id = $2',
					[id, field.id]
				);
			}
		}

		const afterCustom: FormFieldValueMap = {};
		for (const field of fields) {
			afterCustom[field.fieldKey] =
				submitted[field.fieldKey] === undefined
					? beforeCustom[field.fieldKey] ?? ''
					: customValidation.clean[field.fieldKey] ?? '';
		}

		const before = {
			ad: `${current.firstName} ${current.lastName}`.trim(),
			email: String(current.email),
			ogrenciNo: String(current.handle ?? ''),
			bolum: String(current.department ?? ''),
			sinif: Number(current.grade) || 1,
			bio: current.bio ?? '',
			profilFoto: current.avatarUrl ?? null,
			customFields: beforeCustom,
		};
		const after = {
			...before,
			ad: `${ad} ${soyad}`.trim(),
			email,
			ogrenciNo: handle,
			bolum,
			sinif: level,
			bio,
			customFields: afterCustom,
		};
		const fark = alanFarki(before, after);
		if (fark) {
			await logAuditEvent(client, ctx, {
				islem: 'uye.profil',
				hedefTur: 'uye',
				hedefId: id,
				hedefAd: memberTargetName({
					ad: String(current.firstName),
					soyad: String(current.lastName),
					email: String(current.email),
				}),
				onceki: fark.onceki,
				sonraki: fark.sonraki,
			});
		}

		await publishEvent(client, { k: 'yenile' });
	});

	const detail = await getMemberAdminDetail(id);
	if (!detail) return { ok: false, status: 404, error: 'Üye bulunamadı.' };
	return { ok: true, detail };
}

export type SelfUpdateResult =
	| { ok: true }
	| { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

/**
 * The member's own profile: only the safe core fields (bio, track, level) and
 * the custom fields the community marked `selfEditable`. E-mail, handle, name
 * and role are not writable here.
 */
export async function updateSelfProfile(
	userId: string,
	input: Record<string, unknown>,
	ctx: AuditContext
): Promise<SelfUpdateResult> {
	const user = await getUserById(userId);
	if (!user) return { ok: false, status: 404, error: 'Üye bulunamadı.' };
	if (user.status === 'mezun') {
		return { ok: false, status: 403, error: 'Mezunlar sadece okuma erişimine sahiptir.' };
	}

	const [core, fields] = await Promise.all([
		getRegistrationCoreConfig(),
		getFormFields({ scope: 'profile' }),
	]);

	const bolum = readString(input.bolum, user.bolum) || defaultTrackValue(core);
	const rawLevel = input.sinif === undefined ? user.sinif : Number(input.sinif);
	const bio = input.bio === undefined ? user.bio ?? '' : readString(input.bio);

	if (hasUnsafeTextChars(bolum)) {
		return { ok: false, status: 400, error: 'Topluluk alanı geçersiz karakter içeriyor.' };
	}
	if (bio.length > BIO_MAX) {
		return { ok: false, status: 400, error: `Biyografi en fazla ${BIO_MAX} karakter olabilir.` };
	}
	const allowedTracks = new Set(core.track.options.map((option) => option.value));
	if (bolum !== user.bolum && !allowedTracks.has(bolum)) {
		return { ok: false, status: 400, error: 'Listeden bir topluluk alanı seçin.' };
	}
	const allowedLevels = new Set(core.level.options.map((option) => Number(option.value)));
	const level = Number(rawLevel);
	if (!Number.isInteger(level) || (level !== user.sinif && !allowedLevels.has(level))) {
		return { ok: false, status: 400, error: 'Geçerli bir deneyim seviyesi seçin.' };
	}

	const customValidation = validateSelfEditValues(fields, input.customFields);
	if (!customValidation.ok) {
		return {
			ok: false,
			status: 400,
			error: 'Lütfen işaretli alanları düzeltin.',
			fieldErrors: customValidation.errors,
		};
	}

	await withTransaction(async (client) => {
		const currentRes = await client.query(
			`SELECT first_name, last_name, email, department, grade, bio, avatar_url
			 FROM users WHERE id = $1 FOR UPDATE`,
			[userId]
		);
		const current = currentRes.rows[0];
		if (!current) throw new Error('MEMBER_NOT_FOUND');

		const fieldKeys = new Set(fields.map((field) => field.fieldKey));
		const beforeValues = await client.query(
			`SELECT f.field_key AS "fieldKey", v.value
			 FROM member_field_values v
			 JOIN form_fields f ON f.id = v.field_id
			 WHERE v.user_id = $1`,
			[userId]
		);
		const beforeCustom: FormFieldValueMap = {};
		for (const row of beforeValues.rows) {
			const key = String(row.fieldKey);
			if (fieldKeys.has(key)) beforeCustom[key] = String(row.value ?? '');
		}

		await client.query(
			`UPDATE users SET department = $2, grade = $3, bio = $4 WHERE id = $1`,
			[userId, bolum, level, bio || null]
		);
		await setMemberFieldValues(userId, customValidation.clean, fields, client);

		const submitted = input.customFields && typeof input.customFields === 'object'
			? (input.customFields as Record<string, unknown>)
			: {};
		for (const field of fields) {
			const raw = submitted[field.fieldKey];
			if (typeof raw === 'string' && raw.trim() === '') {
				await client.query(
					'DELETE FROM member_field_values WHERE user_id = $1 AND field_id = $2',
					[userId, field.id]
				);
			}
		}

		const afterCustom: FormFieldValueMap = {};
		for (const field of fields) {
			afterCustom[field.fieldKey] =
				submitted[field.fieldKey] === undefined
					? beforeCustom[field.fieldKey] ?? ''
					: customValidation.clean[field.fieldKey] ?? '';
		}

		const before = {
			bolum: String(current.department ?? ''),
			sinif: Number(current.grade) || 1,
			bio: current.bio ?? '',
			customFields: beforeCustom,
		};
		const after = { ...before, bolum, sinif: level, bio, customFields: afterCustom };
		const fark = alanFarki(before, after);
		if (fark) {
			await logAuditEvent(client, ctx, {
				islem: 'uye.profil',
				hedefTur: 'uye',
				hedefId: userId,
				hedefAd: memberTargetName({
					ad: String(current.firstName),
					soyad: String(current.lastName),
					email: String(current.email),
				}),
				onceki: fark.onceki,
				sonraki: fark.sonraki,
			});
		}

		await publishEvent(client, { k: 'yenile' });
	});

	return { ok: true };
}
