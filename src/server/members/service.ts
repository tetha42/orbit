import type { User } from '@/db/schema';
import {
	getFormFields,
	getMemberFieldValues,
	getRegistrationCoreConfig,
	getUserById,
	setMemberFieldValues,
	withTransaction,
} from '@/db';
import { publishEvent } from '@/db/events';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { getRolePermission } from '@/db/roles';
import { fieldDiff, memberTargetName } from '@/lib/audit';
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
	firstName: string;
	lastName: string;
	name: string;
	surname: string;
	email: string;
	handle: string;
	studentNo: string;
	department: string;
	grade: number;
	bio: string;
	avatarUrl: string | null;
	profilePhoto: string | null;
	status: User['status'];
	roleId: string | null;
	roleInfo: { id: string; name: string; color: string } | null;
}

export interface MemberAdminDetail {
	member: MemberAdminMember;
	fields: FormField[];
	allFields?: FormField[];
	customFields: FormFieldValueMap;
	core: Awaited<ReturnType<typeof getRegistrationCoreConfig>>;
}

export type MemberUpdateResult =
	| { ok: true; detail: MemberAdminDetail }
	| { ok: false; status: number; error: string; fieldErrors?: Record<string, string> };

function hasUnsafeTextChars(value: string): boolean {
	return /[<>]|\p{Cc}/u.test(value);
}

function safeMember(user: User, role: MemberAdminMember['roleInfo']): MemberAdminMember {
	const firstName = user.firstName ?? user.name;
	const lastName = user.lastName ?? user.surname;
	const handle = user.handle ?? user.studentNo ?? '';
	const department = user.department ?? user.department;
	const grade = Number(user.grade ?? user.grade) || 1;
	const avatarUrl = user.avatarUrl ?? user.profilePhoto ?? null;
	return {
		id: user.id,
		firstName,
		lastName,
		name: firstName,
		surname: lastName,
		email: user.email,
		handle,
		studentNo: handle,
		department,
		grade,
		bio: user.bio ?? '',
		avatarUrl,
		profilePhoto: avatarUrl,
		status: user.status,
		roleId: user.roleId ?? null,
		roleInfo: role,
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
	const activeFields = allFields.filter((field) => field.enabled);
	const keys = new Set(activeFields.map((field) => field.fieldKey));
	const customFields: FormFieldValueMap = {};
	for (const [key, value] of Object.entries(values)) {
		if (keys.has(key)) customFields[key] = value;
	}
	return {
		member: safeMember(user, role?.role ?? null),
		fields,
		allFields: activeFields,
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

	const name = readString(input.firstName ?? input.name, target.firstName ?? target.name);
	const surname = readString(input.lastName ?? input.surname, target.lastName ?? target.surname);
	const email = readString(input.email, target.email).toLowerCase();
	const handle = readString(input.handle ?? input.studentNo, target.handle ?? target.studentNo ?? '');
	const department = readString(input.department ?? input.department, target.department ?? target.department) || defaultTrackValue(core);
	const rawLevel = input.grade !== undefined ? Number(input.grade) : (input.grade === undefined ? (target.grade ?? target.grade) : Number(input.grade));
	const bio = input.bio === undefined ? target.bio ?? '' : readString(input.bio);

	if (
		name.length < 2 ||
		name.length > 60 ||
		surname.length < 2 ||
		surname.length > 60 ||
		hasUnsafeTextChars(name) ||
		hasUnsafeTextChars(surname) ||
		hasUnsafeTextChars(department)
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
	if (department !== target.department && !allowedTracks.has(department)) {
		return { ok: false, status: 400, error: 'Listeden bir topluluk alanı seçin.' };
	}
	const allowedLevels = new Set(core.level.options.map((option) => Number(option.value)));
	const level = Number(rawLevel);
	if (!Number.isInteger(level) || (level !== target.grade && !allowedLevels.has(level))) {
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
			`SELECT first_name, last_name, email, handle, department, grade, bio, avatar_url, role_id, status, custom_fields
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

		const rawCurrentCustom =
			current.customFields && typeof current.customFields === 'object'
				? (current.customFields as Record<string, unknown>)
				: {};
		const beforeCustom: FormFieldValueMap = {};
		const editableKeys = new Set(fields.map((field) => field.fieldKey));
		for (const [key, val] of Object.entries(rawCurrentCustom)) {
			if (!editableKeys.has(key)) continue;
			beforeCustom[key] = String(val ?? '');
		}

		await client.query(
			`UPDATE users SET
				first_name = $2, last_name = $3, email = $4, handle = $5,
				department = $6, grade = $7, bio = $8
			 WHERE id = $1`,
			[id, name, surname, email, handle, department, level, bio || null]
		);

		await setMemberFieldValues(id, customValidation.clean, fields, client);

		// An optional value the manager cleared must actually disappear, not be
		// silently left behind by the upsert.
		for (const field of fields) {
			if (!field.adminEditable) continue;
			const raw = submitted[field.fieldKey];
			if (typeof raw === 'string' && raw.trim() === '') {
				await client.query(
					`UPDATE users SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) - $2 WHERE id = $1`,
					[id, field.fieldKey]
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
			name: `${current.firstName} ${current.lastName}`.trim(),
			email: String(current.email),
			studentNo: String(current.handle ?? ''),
			department: String(current.department ?? ''),
			grade: Number(current.grade) || 1,
			bio: current.bio ?? '',
			profilePhoto: current.avatarUrl ?? null,
			customFields: beforeCustom,
		};
		const after = {
			...before,
			name: `${name} ${surname}`.trim(),
			email,
			studentNo: handle,
			department,
			grade: level,
			bio,
			customFields: afterCustom,
		};
		const diff = fieldDiff(before, after);
		if (diff) {
			await logAuditEvent(client, ctx, {
				action: 'member.profile',
				targetType: 'member',
				targetId: id,
				targetName: memberTargetName({
					name: String(current.firstName),
					surname: String(current.lastName),
					email: String(current.email),
				}),
				before: diff.before,
				after: diff.after,
			});
		}

		await publishEvent(client, { k: 'refresh' });
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

	const department = readString(input.department, user.department) || defaultTrackValue(core);
	const rawLevel = input.grade === undefined ? user.grade : Number(input.grade);
	const bio = input.bio === undefined ? user.bio ?? '' : readString(input.bio);

	if (hasUnsafeTextChars(department)) {
		return { ok: false, status: 400, error: 'Topluluk alanı geçersiz karakter içeriyor.' };
	}
	if (bio.length > BIO_MAX) {
		return { ok: false, status: 400, error: `Biyografi en fazla ${BIO_MAX} karakter olabilir.` };
	}
	const allowedTracks = new Set(core.track.options.map((option) => option.value));
	if (department !== user.department && !allowedTracks.has(department)) {
		return { ok: false, status: 400, error: 'Listeden bir topluluk alanı seçin.' };
	}
	const allowedLevels = new Set(core.level.options.map((option) => Number(option.value)));
	const level = Number(rawLevel);
	if (!Number.isInteger(level) || (level !== user.grade && !allowedLevels.has(level))) {
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
			`SELECT first_name, last_name, email, department, grade, bio, avatar_url, custom_fields
			 FROM users WHERE id = $1 FOR UPDATE`,
			[userId]
		);
		const current = currentRes.rows[0];
		if (!current) throw new Error('MEMBER_NOT_FOUND');

		const fieldKeys = new Set(fields.map((field) => field.fieldKey));
		const rawCurrentCustom =
			current.customFields && typeof current.customFields === 'object'
				? (current.customFields as Record<string, unknown>)
				: {};
		const beforeCustom: FormFieldValueMap = {};
		for (const [key, val] of Object.entries(rawCurrentCustom)) {
			if (fieldKeys.has(key)) beforeCustom[key] = String(val ?? '');
		}

		await client.query(
			`UPDATE users SET department = $2, grade = $3, bio = $4 WHERE id = $1`,
			[userId, department, level, bio || null]
		);
		await setMemberFieldValues(userId, customValidation.clean, fields, client);

		const submitted = input.customFields && typeof input.customFields === 'object'
			? (input.customFields as Record<string, unknown>)
			: {};
		for (const field of fields) {
			const raw = submitted[field.fieldKey];
			if (typeof raw === 'string' && raw.trim() === '') {
				await client.query(
					`UPDATE users SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) - $2 WHERE id = $1`,
					[userId, field.fieldKey]
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
			department: String(current.department ?? ''),
			grade: Number(current.grade) || 1,
			bio: current.bio ?? '',
			customFields: beforeCustom,
		};
		const after = { ...before, department, grade: level, bio, customFields: afterCustom };
		const diff = fieldDiff(before, after);
		if (diff) {
			await logAuditEvent(client, ctx, {
				action: 'member.profile',
				targetType: 'member',
				targetId: userId,
				targetName: memberTargetName({
					name: String(current.firstName),
					surname: String(current.lastName),
					email: String(current.email),
				}),
				before: diff.before,
				after: diff.after,
			});
		}

		await publishEvent(client, { k: 'refresh' });
	});

	return { ok: true };
}
