import {
	getFormFields,
	getRegistrationCoreConfig,
	getUserById,
	setMemberFieldValues,
	withTransaction,
} from '@/db';
import { publishEvent } from '@/db/events';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { fieldDiff, memberTargetName } from '@/lib/audit';
import { isValidEmail } from '@/lib/mail/address';
import { BIO_MAX } from '@/lib/profile';
import { validateAdminEditValues, type FormFieldValueMap } from '@/lib/formFields';
import { defaultTrackValue } from '@/lib/i18n/data/registrationConfig';
import {
	getMemberAdminDetail,
	hasUnsafeTextChars,
	readString,
	type MemberUpdateResult,
} from './typesAndQueries';

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
	if (!target) return { ok: false, status: 404, error: 'Member not found.' };

	const [core, fields] = await Promise.all([
		getRegistrationCoreConfig(),
		getFormFields({ includeArchived: false }),
	]);

	const name = readString(input.firstName ?? input.name, target.firstName ?? target.name);
	const surname = readString(input.lastName ?? input.surname, target.lastName ?? target.surname);
	const email = readString(input.email, target.email).toLowerCase();
	const handle = readString(input.handle ?? input.studentNo, target.handle ?? target.studentNo ?? '');
	const department = readString(input.department, target.department) || defaultTrackValue(core);
	const rawLevel = input.grade !== undefined ? Number(input.grade) : target.grade;
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
		return { ok: false, status: 400, error: 'Invalid first name, last name, or community track.' };
	}
	if (!handle || !/^[a-zA-Z0-9_-]{3,32}$/.test(handle)) {
		return {
			ok: false,
			status: 400,
			error: 'Member handle / username must be 3-32 characters using letters, numbers, hyphens, and underscores.',
		};
	}
	if (!isValidEmail(email)) {
		return { ok: false, status: 400, error: 'Enter a valid email address.' };
	}
	if (bio.length > BIO_MAX) {
		return { ok: false, status: 400, error: `Bio can be at most ${BIO_MAX} characters.` };
	}

	const allowedTracks = new Set(core.track.options.map((option) => option.value));
	if (department !== target.department && !allowedTracks.has(department)) {
		return { ok: false, status: 400, error: 'Select a community track from the list.' };
	}
	const allowedLevels = new Set(core.level.options.map((option) => Number(option.value)));
	const level = Number(rawLevel);
	if (!Number.isInteger(level) || (level !== target.grade && !allowedLevels.has(level))) {
		return { ok: false, status: 400, error: 'Select a valid experience level.' };
	}

	const customValidation = validateAdminEditValues(fields, input.customFields);
	if (!customValidation.ok) {
		return {
			ok: false,
			status: 400,
			error: 'Please fix the highlighted fields.',
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
	if (!detail) return { ok: false, status: 404, error: 'Member not found.' };
	return { ok: true, detail };
}
