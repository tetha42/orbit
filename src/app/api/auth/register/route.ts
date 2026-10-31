import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
	getUserByEmail,
	getUserByHandle,
	createUser,
	getPgPool,
	getSystemSettings,
	getFormFields,
	getLegalDocuments,
	acceptLegalDocuments,
	getRegistrationCoreConfig,
	setMemberFieldValues,
	getMembershipPolicy,
	findInvitationByTokenHash,
	consumeInvitation,
	createMembershipApplication,
	getLatestApplication,
	enqueueMail,
} from '@/db';
import { defaultLevelValue, defaultTrackValue } from '@/lib/registrationConfig';
import { validateFormValues } from '@/lib/formFields';
import { emailDomainAllowed } from '@/lib/membershipPolicy';
import { notifyRegistrationReceived, notifyEmailVerificationCode } from '@/lib/mail/notifications';
import { wasDelivered } from '@/lib/mail/mailer';
import { isValidEmail } from '@/lib/mail/address';
import { clearRateLimit, consumeRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { passwordProblem } from '@/lib/profile';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { getEmergencyKillSwitches, getLockdownState, isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';
import { hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';

const MAX_OTP_ATTEMPTS = 5;
const OTP_WINDOW_MS = 15 * 60_000;

function hasUnsafeTextChars(value: string): boolean {
	return /[<>]|\p{Cc}/u.test(value);
}

function generateMemberHandle(): string {
	return `ORB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function POST(request: Request) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return NextResponse.json(
			{ error: 'Your IP address has been temporarily quarantined due to security policy.' },
			{ status: 403 }
		);
	}
	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[WAF] Attack signature blocked (${waf.signature}): POST /api/auth/register`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/auth/register',
		});
		return NextResponse.json(
			{ error: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}
	const lockdown = await getLockdownState();
	if (lockdown.active) {
		return NextResponse.json(
			{ error: 'The system is currently in high-security Defcon Lockdown mode. New member registrations are temporarily paused.' },
			{ status: 503 }
		);
	}
	const emergency = await getEmergencyKillSwitches();
	if (emergency.disableRegistrations) {
		return NextResponse.json(
			{ error: 'Registrations are currently disabled by emergency security protocol (Kill-Switch).' },
			{ status: 503 }
		);
	}
	const limit = consumeRateLimit(`register:${ip}`, 10, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many requests. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
		);
	}
	try {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
		}
		const { ad, soyad, email, password, ogrenciNo, memberId, bolum, sinif, verificationCode, hp_website, inviteToken } = body;

		// Anti-bot Honeypot Check
		if (hp_website || (body as Record<string, unknown>).trap_website) {
			void recordSecurityStrike({
				ip,
				points: 30,
				reason: 'Bot Honeypot Triggered: POST /api/auth/register',
				path: '/api/auth/register',
			});
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `[Honeypot] Automated bot registration attempt blocked: ${ip}`,
				detay: { ip },
				ip,
			});
			return NextResponse.json({ error: 'Invalid form submission detected.', bot_detected: true }, { status: 400 });
		}

		const normalizedEmail = String(email || '').trim().toLowerCase();
		const membershipPolicy = await getMembershipPolicy();
		const rawInvite = String(inviteToken ?? '').trim();
		let invitation: Awaited<ReturnType<typeof findInvitationByTokenHash>> = null;
		if (rawInvite) {
			if (!membershipPolicy.inviteEnabled) {
				return NextResponse.json({ error: 'Davet ile kayıt şu anda kapalı.' }, { status: 403 });
			}
			const tokenHash = crypto.createHash('sha256').update(rawInvite).digest('hex');
			invitation = await findInvitationByTokenHash(tokenHash);
			if (!invitation || invitation.expiresAt <= Date.now()) {
				return NextResponse.json({ error: 'Davet bağlantısı geçersiz veya süresi dolmuş.' }, { status: 400 });
			}
			if (invitation.email && invitation.email !== normalizedEmail) {
				return NextResponse.json({ error: 'Bu davet farklı bir e-posta adresi için oluşturulmuş.' }, { status: 400 });
			}
		} else if (membershipPolicy.selfRegistration !== 'open') {
			return NextResponse.json({ error: 'Yeni üye kayıtları şu anda kapalı.' }, { status: 403 });
		}
		if (!invitation && !emailDomainAllowed(normalizedEmail, membershipPolicy.allowedEmailDomains)) {
			return NextResponse.json(
				{ error: 'Bu e-posta alan adı topluluk kayıt kurallarına uygun değil.' },
				{ status: 400 }
			);
		}
		const rawHandle = String(ogrenciNo ?? memberId ?? '').trim();
		// The handle can be optional or mandatory, as configured in Settings.
		const coreConfig = await getRegistrationCoreConfig();
		if (coreConfig.memberId.required && !rawHandle) {
			return NextResponse.json(
				{ error: 'Please enter a member ID / handle.' },
				{ status: 400 }
			);
		}
		const cleanOgrenciNo = rawHandle || generateMemberHandle();
		const cleanName = String(ad || '').trim();
		const cleanSoyad = String(soyad || '').trim();
		// If a community hides the track/level fields, the first configured option
		// is the canonical default rather than a hard-coded student label.
		const cleanBolum = String(bolum || '').trim() || defaultTrackValue(coreConfig);

		if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanOgrenciNo)) {
			return NextResponse.json(
				{ error: 'Member ID / Handle must be 3–32 characters using letters, numbers, hyphens, or underscores.' },
				{ status: 400 }
			);
		}

		if (!cleanName || !cleanSoyad || !normalizedEmail || typeof password !== 'string' || !password || !cleanBolum) {
			return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 });
		}

		if (
			cleanName.length < 2 ||
			cleanName.length > 60 ||
			cleanSoyad.length < 2 ||
			cleanSoyad.length > 60 ||
			cleanBolum.length < 2 ||
			cleanBolum.length > 100 ||
			hasUnsafeTextChars(cleanName) ||
			hasUnsafeTextChars(cleanSoyad) ||
			hasUnsafeTextChars(cleanBolum)
		) {
			return NextResponse.json({ error: 'Invalid characters or length in first name, last name, or track.' }, { status: 400 });
		}

		const parsedGrade =
			sinif === undefined || sinif === null || sinif === ''
				? defaultLevelValue(coreConfig)
				: Number(sinif);
		const allowedLevels = new Set(coreConfig.level.options.map((option) => Number(option.value)));
		if (!Number.isInteger(parsedGrade) || !allowedLevels.has(parsedGrade)) {
			return NextResponse.json(
				{ error: 'Experience level must be one of the configured options.' },
				{ status: 400 }
			);
		}

		// Legal acceptance follows the documents configured in Settings. Every
		// required document must be explicitly accepted; the client cannot fall back
		// to a blanket boolean, and the accepted version is stored as evidence after
		// the account is created.
		const legalDocuments = await getLegalDocuments({ enabledOnly: true, forRegistration: true });
		const requiredDocuments = legalDocuments.filter((document) => document.required);
		const accepted = new Set(
			Array.isArray(body.acceptedDocumentIds)
				? body.acceptedDocumentIds.filter((id: unknown): id is string => typeof id === 'string')
				: []
		);
		const missing = requiredDocuments.filter((document) => !accepted.has(document.id));
		if (missing.length > 0) {
			return NextResponse.json(
				{
					error: `You must accept: ${missing.map((document) => document.titleEn).join(', ')}.`,
					code: 'LEGAL_ACCEPTANCE_REQUIRED',
					missingDocumentIds: missing.map((document) => document.id),
				},
				{ status: 400 }
			);
		}
		const acceptedDocuments = legalDocuments.filter((document) => accepted.has(document.id));

		const registrationFields = await getFormFields({ scope: 'registration', enabledOnly: true });
		const customValidation = validateFormValues(registrationFields, body.customFields, 'registration');
		if (!customValidation.ok) {
			return NextResponse.json(
				{
					error: 'Please correct the highlighted fields.',
					code: 'INVALID_FORM_FIELDS',
					fieldErrors: customValidation.errors,
				},
				{ status: 400 }
			);
		}

		if (!isValidEmail(normalizedEmail)) {
			return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
		}

		const passProblem = passwordProblem(password, { email: normalizedEmail });
		if (passProblem) {
			return NextResponse.json({ error: passProblem }, { status: 400 });
		}

		// Email uniqueness check. A rejected application may apply again once the
		// policy cooldown has elapsed; pending/active/alumni accounts stay closed.
		const existingUser = await getUserByEmail(normalizedEmail);
		let reapplyUser: typeof existingUser = null;
		let reapplyOf: string | null = null;
		if (existingUser) {
			if (existingUser.status !== 'reddedildi') {
				return NextResponse.json(
					{ error: 'An account or pending application with this email address already exists.' },
					{ status: 409 }
				);
			}
			const latest = await getLatestApplication(existingUser.id);
			if (latest && ['submitted', 'email_verified', 'pending_review'].includes(latest.status)) {
				return NextResponse.json(
					{ error: 'Bu e-posta için zaten açık bir başvuru var.' },
					{ status: 409 }
				);
			}
			const rejectedAt = latest?.reviewedAt ?? latest?.createdAt ?? 0;
			const cooldownMs = membershipPolicy.reapplyCooldownDays * 86_400_000;
			if (cooldownMs > 0 && rejectedAt > 0 && Date.now() < rejectedAt + cooldownMs) {
				const retryAt = rejectedAt + cooldownMs;
				return NextResponse.json(
					{
						error: 'Yeniden başvuru bekleme süresi henüz dolmadı.',
						code: 'REAPPLY_COOLDOWN',
						retryAt,
					},
					{ status: 403 }
				);
			}
			reapplyOf = latest?.id ?? null;
			reapplyUser = existingUser;
		}

		// Member ID / Handle uniqueness check
		const existingOgrenci = await getUserByHandle(cleanOgrenciNo);
		if (existingOgrenci && existingOgrenci.id !== reapplyUser?.id) {
			return NextResponse.json({ error: 'This Member ID / Handle is already registered.' }, { status: 409 });
		}

		const pool = getPgPool();
		// Purge expired OTP records immediately
		await pool.query('DELETE FROM email_verifications WHERE expires_at < $1', [Date.now()]);

		const verifyKey = `register:verify:${normalizedEmail}`;

		if (membershipPolicy.emailVerification) {
		// STEP 1: Generate and send verification code if not provided yet
		if (!verificationCode) {
			const sendLimit = consumeRateLimit(`register:send:${normalizedEmail}`, 3, OTP_WINDOW_MS);
			if (!sendLimit.allowed) {
				return NextResponse.json(
					{ error: 'Verification codes requested too frequently for this email address. Please try again later.' },
					{ status: 429, headers: { 'Retry-After': String(sendLimit.retryAfter) } },
				);
			}

			const code = String(crypto.randomInt(100000, 1000000));
			const sonGecerlilik = Date.now() + OTP_WINDOW_MS;
			const hashedCode = hashOtpCode(code);

			await pool.query(
				`INSERT INTO email_verifications (email, code, type, expires_at, created_at)
				 VALUES ($1, $2, 'registration', $3, $4)
				 ON CONFLICT (email) DO UPDATE SET code = $2, type = 'registration', expires_at = $3, created_at = $4`,
				[normalizedEmail, hashedCode, sonGecerlilik, Date.now()]
			);

			clearRateLimit(verifyKey);

			const delivery = await notifyEmailVerificationCode(
				{ ad: cleanName, soyad: cleanSoyad, email: normalizedEmail },
				code
			);
			let mailQueued = false;
			if (!wasDelivered(delivery)) {
				// SMTP is missing or temporarily down. Keep the code in the admin
				// outbox instead of silently telling the applicant it was sent.
				try {
					const queuedExpiry = Date.now() + 24 * 60 * 60_000;
					await pool.query(
						'UPDATE email_verifications SET expires_at = $1 WHERE email = $2 AND type = $3',
						[queuedExpiry, normalizedEmail, 'registration']
					);
					await enqueueMail({
						kind: 'registration_verification',
						recipient: normalizedEmail,
						subject: `E-posta Doğrulama Kodu — ${cleanName} ${cleanSoyad}`,
						payload: { code },
					});
					mailQueued = true;
					await logSystemEvent({
						servis: 'auth',
						seviye: 'WARN',
						mesaj: `Registration verification e-mail queued for admin approval: ${normalizedEmail}`,
						detay: { reason: delivery.simulated ? 'smtp_not_configured' : delivery.error },
						ip,
					});
				} catch (queueError) {
					console.error('[register] verification mail could not be queued:', queueError);
				}
			}

			await logSystemEvent({
				servis: 'auth',
				seviye: 'INFO',
				mesaj: mailQueued
					? `Registration verification code queued for approval: ${normalizedEmail}`
					: `Registration verification code sent: ${normalizedEmail}`,
				ip,
			});

			return NextResponse.json({
				success: true,
				requireVerification: true,
				memberId: cleanOgrenciNo,
				mailQueued,
				message: mailQueued
					? `E-posta servisi şu anda kullanılamıyor. Doğrulama kodunuz yönetici onayına alındı; onaylandığında ${normalizedEmail} adresine gönderilecek.`
					: `A 6-digit verification code has been sent to ${normalizedEmail}. Please enter the code to complete registration.`,
			});
		}

		// STEP 2: Verify the submitted OTP code
		const gate = isRateLimited(verifyKey, MAX_OTP_ATTEMPTS);
		if (!gate.allowed) {
			await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2', [
				normalizedEmail,
				'registration',
			]);
			return NextResponse.json(
				{ error: 'Too many invalid verification attempts. Please request a new code.' },
				{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
			);
		}

		const codeRes = await pool.query(
			'SELECT code AS kod, expires_at AS songecerlilik FROM email_verifications WHERE email = $1 AND type = $2',
			[normalizedEmail, 'registration']
		);

		const record = codeRes.rows[0];
		const expectedCode = record ? String(record.kod ?? record.code ?? '').trim() : '';
		const submittedCode = String(verificationCode).trim();
		if (!record || !verifyOtpCode(expectedCode, submittedCode)) {
			const attempts = recordFailure(verifyKey, OTP_WINDOW_MS);
			if (attempts >= MAX_OTP_ATTEMPTS) {
				await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2', [
					normalizedEmail,
					'registration',
				]);
			}
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Failed registration OTP attempt: ${normalizedEmail}`,
				detay: { email: normalizedEmail, denemeSayisi: attempts },
				ip,
			});
			return NextResponse.json({ error: 'The verification code you entered is invalid.' }, { status: 400 });
		}

		const sonGecerlilik = Number(record.songecerlilik ?? record.expiresAt ?? record.expires_at ?? 0);
		if (sonGecerlilik < Date.now()) {
			return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
		}

		// Valid code — delete OTP record
		await pool.query('DELETE FROM email_verifications WHERE email = $1', [normalizedEmail]);
		clearRateLimit(verifyKey);
		}

		// Hash password with Bcrypt (cost factor 12)
		const passwordHash = await bcrypt.hash(password, 12);

		// Create a new pending account, or revive a rejected one in place.
		const emailVerifiedAt = membershipPolicy.emailVerification ? Date.now() : null;
		let newUser;
		if (reapplyUser) {
			const revived = await getPgPool().query(
				`UPDATE users SET
					first_name = $2, last_name = $3, handle = $4, department = $5, grade = $6,
					password_hash = $7, status = 'beklemede', role_id = $8, email_verified_at = $9
				 WHERE id = $1 AND status = 'reddedildi'
				 RETURNING id`,
				[
					reapplyUser.id,
					cleanName,
					cleanSoyad,
					cleanOgrenciNo,
					cleanBolum,
					parsedGrade,
					passwordHash,
					invitation?.roleId ?? null,
					emailVerifiedAt,
				]
			);
			if (!revived.rowCount) {
				return NextResponse.json(
					{ error: 'Başvuru durumu değişti. Lütfen sayfayı yenileyip tekrar deneyin.' },
					{ status: 409 }
				);
			}
			newUser = {
				...reapplyUser,
				ad: cleanName,
				soyad: cleanSoyad,
				ogrenciNo: cleanOgrenciNo,
				bolum: cleanBolum,
				sinif: parsedGrade,
				status: 'beklemede' as const,
				roleId: invitation?.roleId ?? null,
			};
		} else {
			newUser = await createUser({
				ad: cleanName,
				soyad: cleanSoyad,
				email: normalizedEmail,
				passwordHash,
				ogrenciNo: cleanOgrenciNo,
				bolum: cleanBolum,
				status: 'beklemede',
				sinif: parsedGrade,
				roleId: invitation?.roleId ?? null,
			});
			await getPgPool().query('UPDATE users SET email_verified_at = $1 WHERE id = $2', [
				emailVerifiedAt,
				newUser.id,
			]);
		}

		if (Object.keys(customValidation.clean).length > 0) {
			await setMemberFieldValues(newUser.id, customValidation.clean, registrationFields);
		}

		// Persist the exact document versions and text hashes the member accepted.
		// This is the compliance evidence; it is never derived from a later edit of
		// the legal text.
		await acceptLegalDocuments(newUser.id, acceptedDocuments, {
			ip: clientAddress(request),
			userAgent: request.headers.get('user-agent'),
			source: 'registration',
		});

		if (invitation) await consumeInvitation(invitation.id, newUser.id);
		await createMembershipApplication({
			userId: newUser.id,
			source: invitation ? 'invite' : 'self',
			status: 'pending_review',
			snapshot: {
				ad: cleanName,
				soyad: cleanSoyad,
				email: normalizedEmail,
				ogrenciNo: cleanOgrenciNo,
				bolum: cleanBolum,
				sinif: parsedGrade,
				customFields: customValidation.clean,
				acceptedDocumentIds: [...accepted],
				invitationId: invitation?.id ?? null,
				reapplyOf,
			},
			invitationId: invitation?.id ?? null,
			reapplyOf,
			emailVerifiedAt,
		});

		const settings = await getSystemSettings();
		const welcomeTemplate = settings.mail_welcome_template || '';

		void notifyRegistrationReceived(
			{
				ad: newUser.ad,
				soyad: newUser.soyad,
				email: newUser.email,
			},
			welcomeTemplate
		);

		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `New membership application received${emailVerifiedAt ? ' (email verified)' : ''}: ${newUser.ad} ${newUser.soyad} (${newUser.email}) - ID: ${cleanOgrenciNo}`,
			userId: newUser.id,
			ip: clientAddress(request),
		});

		return NextResponse.json({
			success: true,
			message: emailVerifiedAt
				? 'Your membership application has been received and your email is verified! You can sign in once an administrator approves your account.'
				: 'Your membership application has been received. You can sign in once an administrator approves your account.',
			user: {
				id: newUser.id,
				ad: newUser.ad,
				soyad: newUser.soyad,
				email: newUser.email,
				status: newUser.status,
			},
		});
	} catch (error: unknown) {
		const pgError = error as { code?: string; detail?: string };
		if (pgError?.code === '23505') {
			return NextResponse.json(
				{ error: 'This email address or Member ID / Handle is already registered.' },
				{ status: 409 }
			);
		}
		console.error('API error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
