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
import { BIO_MAX } from '@/lib/profile';
import { validateSelfEditValues, type FormFieldValueMap } from '@/lib/formFields';
import { defaultTrackValue } from '@/lib/i18n/data/registrationConfig';
import { hasUnsafeTextChars, readString, type SelfUpdateResult } from './typesAndQueries';

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
	if (!user) return { ok: false, status: 404, error: 'Member not found.' };
	if (user.status === 'alumni') {
		return { ok: false, status: 403, error: 'Alumni accounts have read-only access.' };
	}

	const [core, fields] = await Promise.all([
		getRegistrationCoreConfig(),
		getFormFields({ scope: 'profile' }),
	]);

	const department = readString(input.department, user.department) || defaultTrackValue(core);
	const rawLevel = input.grade === undefined ? user.grade : Number(input.grade);
	const bio = input.bio === undefined ? user.bio ?? '' : readString(input.bio);
	const preferredLanguage =
		input.preferredLanguage === 'tr' ? 'tr' : input.preferredLanguage === 'en' ? 'en' : user.preferredLanguage === 'tr' ? 'tr' : 'en';

	if (hasUnsafeTextChars(department)) {
		return { ok: false, status: 400, error: 'Community track contains invalid characters.' };
	}
	if (bio.length > BIO_MAX) {
		return { ok: false, status: 400, error: `Bio can be at most ${BIO_MAX} characters.` };
	}
	const allowedTracks = new Set(core.track.options.map((option) => option.value));
	if (department !== user.department && !allowedTracks.has(department)) {
		return { ok: false, status: 400, error: 'Select a community track from the list.' };
	}
	const allowedLevels = new Set(core.level.options.map((option) => Number(option.value)));
	const level = Number(rawLevel);
	if (!Number.isInteger(level) || (level !== user.grade && !allowedLevels.has(level))) {
		return { ok: false, status: 400, error: 'Select a valid experience level.' };
	}

	const customValidation = validateSelfEditValues(fields, input.customFields);
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
			`SELECT first_name, last_name, email, department, grade, bio, avatar_url, custom_fields, preferred_language
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
			`UPDATE users SET department = $2, grade = $3, bio = $4, preferred_language = $5 WHERE id = $1`,
			[userId, department, level, bio || null, preferredLanguage]
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
			preferredLanguage: current.preferredLanguage === 'tr' ? 'tr' : 'en',
			customFields: beforeCustom,
		};
		const after = { ...before, department, grade: level, bio, preferredLanguage, customFields: afterCustom };
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
