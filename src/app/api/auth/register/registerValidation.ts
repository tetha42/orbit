import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
	getUserByEmail,
	getUserByHandle,
	getFormFields,
	getLegalDocuments,
	getRegistrationCoreConfig,
	getMembershipPolicy,
	findInvitationByTokenHash,
	getLatestApplication,
} from '@/db';
import { defaultLevelValue, defaultTrackValue } from '@/lib/i18n/data/registrationConfig';
import { validateFormValues } from '@/lib/formFields';
import { emailDomainAllowed } from '@/lib/membershipPolicy';
import { isValidEmail } from '@/lib/mail/address';
import { passwordProblem } from '@/lib/profile';

function hasUnsafeTextChars(value: string): boolean {
	return /[<>]|\p{Cc}/u.test(value);
}

function generateMemberHandle(): string {
	return `ORB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export interface ValidatedRegistrationInput {
	normalizedEmail: string;
	password: string;
	cleanName: string;
	cleanSurname: string;
	cleanStudentNo: string;
	cleanDepartment: string;
	parsedGrade: number;
	userLang: 'tr' | 'en';
	verificationCode: unknown;
	membershipPolicy: Awaited<ReturnType<typeof getMembershipPolicy>>;
	invitation: Awaited<ReturnType<typeof findInvitationByTokenHash>>;
	acceptedDocuments: Awaited<ReturnType<typeof getLegalDocuments>>;
	acceptedIds: Set<string>;
	registrationFields: Awaited<ReturnType<typeof getFormFields>>;
	customClean: Record<string, string>;
	reapplyUser: Awaited<ReturnType<typeof getUserByEmail>>;
	reapplyOf: string | null;
}

export async function validateRegistrationInput(
	body: Record<string, unknown>
): Promise<{ ok: true; data: ValidatedRegistrationInput } | { ok: false; response: NextResponse }> {
	const email = body.email;
	const password = body.password;
	const name = body.firstName ?? body.name;
	const surname = body.lastName ?? body.surname;
	const studentNo = body.handle ?? body.studentNo ?? body.memberId;
	const department = body.department;
	const grade = body.grade;
	const { verificationCode, inviteToken, preferredLanguage } = body;
	const userLang: 'tr' | 'en' = preferredLanguage === 'tr' ? 'tr' : 'en';

	const normalizedEmail = String(email || '').trim().toLowerCase();
	const membershipPolicy = await getMembershipPolicy();
	const rawInvite = String(inviteToken ?? '').trim();
	let invitation: Awaited<ReturnType<typeof findInvitationByTokenHash>> = null;
	if (rawInvite) {
		if (!membershipPolicy.inviteEnabled) {
			return { ok: false, response: NextResponse.json({ error: 'Invite-only registration is currently disabled.' }, { status: 403 }) };
		}
		const tokenHash = crypto.createHash('sha256').update(rawInvite).digest('hex');
		invitation = await findInvitationByTokenHash(tokenHash);
		if (!invitation || invitation.expiresAt <= Date.now()) {
			return { ok: false, response: NextResponse.json({ error: 'Invitation link is invalid or has expired.' }, { status: 400 }) };
		}
		if (invitation.email && invitation.email !== normalizedEmail) {
			return { ok: false, response: NextResponse.json({ error: 'This invitation was created for a different email address.' }, { status: 400 }) };
		}
	} else if (membershipPolicy.selfRegistration !== 'open') {
		return { ok: false, response: NextResponse.json({ error: 'New member registrations are currently closed.' }, { status: 403 }) };
	}
	if (!invitation && !emailDomainAllowed(normalizedEmail, membershipPolicy.allowedEmailDomains)) {
		return {
			ok: false,
			response: NextResponse.json({ error: 'This email domain is not allowed by community registration policy.' }, { status: 400 }),
		};
	}

	const rawHandle = String(studentNo ?? '').trim();
	const coreConfig = await getRegistrationCoreConfig();
	if (coreConfig.memberId.required && !rawHandle) {
		return { ok: false, response: NextResponse.json({ error: 'Please enter a member ID / handle.' }, { status: 400 }) };
	}
	const cleanStudentNo = rawHandle || generateMemberHandle();
	const cleanName = String(name || '').trim();
	const cleanSurname = String(surname || '').trim();
	const cleanDepartment = String(department || '').trim() || defaultTrackValue(coreConfig);

	if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanStudentNo)) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: 'Member ID / Handle must be 3–32 characters using letters, numbers, hyphens, or underscores.' },
				{ status: 400 }
			),
		};
	}

	if (!cleanName || !cleanSurname || !normalizedEmail || typeof password !== 'string' || !password || !cleanDepartment) {
		return { ok: false, response: NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 }) };
	}

	if (
		cleanName.length < 2 ||
		cleanName.length > 60 ||
		cleanSurname.length < 2 ||
		cleanSurname.length > 60 ||
		cleanDepartment.length < 2 ||
		cleanDepartment.length > 100 ||
		hasUnsafeTextChars(cleanName) ||
		hasUnsafeTextChars(cleanSurname) ||
		hasUnsafeTextChars(cleanDepartment)
	) {
		return {
			ok: false,
			response: NextResponse.json({ error: 'Invalid characters or length in first name, last name, or track.' }, { status: 400 }),
		};
	}

	const parsedGrade =
		grade === undefined || grade === null || grade === '' ? defaultLevelValue(coreConfig) : Number(grade);
	const allowedLevels = new Set(coreConfig.level.options.map((option) => Number(option.value)));
	if (!Number.isInteger(parsedGrade) || !allowedLevels.has(parsedGrade)) {
		return {
			ok: false,
			response: NextResponse.json({ error: 'Experience level must be one of the configured options.' }, { status: 400 }),
		};
	}

	const legalDocuments = await getLegalDocuments({ enabledOnly: true, forRegistration: true });
	const requiredDocuments = legalDocuments.filter((document) => document.required);
	const acceptedIds = new Set(
		Array.isArray(body.acceptedDocumentIds)
			? body.acceptedDocumentIds.filter((id: unknown): id is string => typeof id === 'string')
			: requiredDocuments.map((document) => document.id)
	);
	const missing = requiredDocuments.filter((document) => !acceptedIds.has(document.id));
	if (missing.length > 0) {
		return {
			ok: false,
			response: NextResponse.json(
				{
					error: `You must accept: ${missing.map((document) => document.titleEn).join(', ')}.`,
					code: 'LEGAL_ACCEPTANCE_REQUIRED',
					missingDocumentIds: missing.map((document) => document.id),
				},
				{ status: 400 }
			),
		};
	}
	const acceptedDocuments = legalDocuments.filter((document) => acceptedIds.has(document.id));

	const registrationFields = await getFormFields({ scope: 'registration', enabledOnly: true });
	const customValidation = validateFormValues(registrationFields, body.customFields as Record<string, unknown> | undefined, 'registration');
	if (!customValidation.ok) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: 'Please correct the highlighted fields.', code: 'INVALID_FORM_FIELDS', fieldErrors: customValidation.errors },
				{ status: 400 }
			),
		};
	}

	if (!isValidEmail(normalizedEmail)) {
		return { ok: false, response: NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 }) };
	}

	const passProblem = passwordProblem(password, { email: normalizedEmail });
	if (passProblem) {
		return { ok: false, response: NextResponse.json({ error: passProblem }, { status: 400 }) };
	}

	const existingUser = await getUserByEmail(normalizedEmail);
	let reapplyUser: typeof existingUser = null;
	let reapplyOf: string | null = null;
	if (existingUser) {
		if (existingUser.status !== 'rejected') {
			return {
				ok: false,
				response: NextResponse.json(
					{ error: 'An account or pending application with this email address already exists.' },
					{ status: 409 }
				),
			};
		}
		const latest = await getLatestApplication(existingUser.id);
		if (latest && ['submitted', 'email_verified', 'pending_review'].includes(latest.status)) {
			return { ok: false, response: NextResponse.json({ error: 'An open application already exists for this email address.' }, { status: 409 }) };
		}
		const rejectedAt = latest?.reviewedAt ?? latest?.createdAt ?? 0;
		const cooldownMs = membershipPolicy.reapplyCooldownDays * 86_400_000;
		if (cooldownMs > 0 && rejectedAt > 0 && Date.now() < rejectedAt + cooldownMs) {
			return {
				ok: false,
				response: NextResponse.json(
					{ error: 'Re-application cooldown period has not elapsed yet.', code: 'REAPPLY_COOLDOWN', retryAt: rejectedAt + cooldownMs },
					{ status: 403 }
				),
			};
		}
		reapplyOf = latest?.id ?? null;
		reapplyUser = existingUser;
	}

	const existingStudent = await getUserByHandle(cleanStudentNo);
	if (existingStudent && existingStudent.id !== reapplyUser?.id) {
		return { ok: false, response: NextResponse.json({ error: 'This Member ID / Handle is already registered.' }, { status: 409 }) };
	}

	return {
		ok: true,
		data: {
			normalizedEmail,
			password,
			cleanName,
			cleanSurname,
			cleanStudentNo,
			cleanDepartment,
			parsedGrade,
			userLang,
			verificationCode,
			membershipPolicy,
			invitation,
			acceptedDocuments,
			acceptedIds,
			registrationFields,
			customClean: customValidation.clean,
			reapplyUser,
			reapplyOf,
		},
	};
}
