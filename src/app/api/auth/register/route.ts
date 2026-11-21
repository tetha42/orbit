import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
	createUser,
	getPgPool,
	getSystemSettings,
	acceptLegalDocuments,
	setMemberFieldValues,
	consumeInvitation,
	createMembershipApplication,
} from '@/db';
import { notifyRegistrationReceived } from '@/lib/mail/notifications/membershipEmails';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { getEmergencyKillSwitches, getLockdownState, isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
import { validateRegistrationInput } from './registerValidation';
import { handleRegistrationOtp } from './registerOtp';

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
			service: 'security',
			level: 'ERROR',
			message: `[WAF] Attack signature blocked (${waf.signature}): POST /api/auth/register`,
			detail: { category: waf.category, signature: waf.signature },
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
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}
	try {
		const rawBody = await request.json().catch(() => null);
		if (!rawBody || typeof rawBody !== 'object') {
			return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
		}
		const body = rawBody as Record<string, unknown>;

		// Anti-bot Honeypot Check
		if (body.hp_website || body.trap_website) {
			void recordSecurityStrike({
				ip,
				points: 30,
				reason: 'Bot Honeypot Triggered: POST /api/auth/register',
				path: '/api/auth/register',
			});
			void logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `[Honeypot] Automated bot registration attempt blocked: ${ip}`,
				detail: { ip },
				ip,
			});
			return NextResponse.json({ error: 'Invalid form submission detected.', bot_detected: true }, { status: 400 });
		}

		const validated = await validateRegistrationInput(body);
		if (!validated.ok) return validated.response;
		const d = validated.data;

		const otpResponse = await handleRegistrationOtp(d, ip);
		if (otpResponse) return otpResponse;

		const passwordHash = await bcrypt.hash(d.password, 12);
		const emailVerifiedAt = d.membershipPolicy.emailVerification ? Date.now() : null;
		let newUser;
		if (d.reapplyUser) {
			const revived = await getPgPool().query(
				`UPDATE users SET
					first_name = $2, last_name = $3, handle = $4, department = $5, grade = $6,
					password_hash = $7, status = 'pending', role_id = $8, email_verified_at = $9, preferred_language = $10
				 WHERE id = $1 AND status = 'rejected'
				 RETURNING id`,
				[
					d.reapplyUser.id,
					d.cleanName,
					d.cleanSurname,
					d.cleanStudentNo,
					d.cleanDepartment,
					d.parsedGrade,
					passwordHash,
					d.invitation?.roleId ?? null,
					emailVerifiedAt,
					d.userLang,
				]
			);
			if (!revived.rowCount) {
				return NextResponse.json(
					{ error: 'Application status has changed. Please refresh the page and try again.' },
					{ status: 409 }
				);
			}
			newUser = {
				...d.reapplyUser,
				name: d.cleanName,
				surname: d.cleanSurname,
				studentNo: d.cleanStudentNo,
				department: d.cleanDepartment,
				grade: d.parsedGrade,
				status: 'pending' as const,
				roleId: d.invitation?.roleId ?? null,
				preferredLanguage: d.userLang,
			};
		} else {
			newUser = await createUser({
				name: d.cleanName,
				surname: d.cleanSurname,
				email: d.normalizedEmail,
				passwordHash,
				studentNo: d.cleanStudentNo,
				department: d.cleanDepartment,
				status: 'pending',
				grade: d.parsedGrade,
				roleId: d.invitation?.roleId ?? null,
				preferredLanguage: d.userLang,
			});
			await getPgPool().query('UPDATE users SET email_verified_at = $1 WHERE id = $2', [emailVerifiedAt, newUser.id]);
		}

		if (Object.keys(d.customClean).length > 0) {
			await setMemberFieldValues(newUser.id, d.customClean, d.registrationFields);
		}

		await acceptLegalDocuments(newUser.id, d.acceptedDocuments, {
			ip: clientAddress(request),
			userAgent: request.headers.get('user-agent'),
			source: 'registration',
		});

		if (d.invitation) await consumeInvitation(d.invitation.id, newUser.id);
		await createMembershipApplication({
			userId: newUser.id,
			source: d.invitation ? 'invite' : 'self',
			status: 'pending_review',
			snapshot: {
				name: d.cleanName,
				surname: d.cleanSurname,
				email: d.normalizedEmail,
				studentNo: d.cleanStudentNo,
				department: d.cleanDepartment,
				grade: d.parsedGrade,
				customFields: d.customClean,
				acceptedDocumentIds: [...d.acceptedIds],
				invitationId: d.invitation?.id ?? null,
				reapplyOf: d.reapplyOf,
			},
			invitationId: d.invitation?.id ?? null,
			reapplyOf: d.reapplyOf,
			emailVerifiedAt,
		});

		const settings = await getSystemSettings();
		void notifyRegistrationReceived(
			{ name: newUser.name, surname: newUser.surname, email: newUser.email, preferredLanguage: d.userLang },
			settings.mail_welcome_template || '',
			d.userLang
		);

		await logSystemEvent({
			service: 'auth',
			level: 'INFO',
			message: `New membership application received${emailVerifiedAt ? ' (email verified)' : ''}: ${newUser.name} ${newUser.surname} (${newUser.email}) - ID: ${d.cleanStudentNo}`,
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
				name: newUser.name,
				surname: newUser.surname,
				email: newUser.email,
				status: newUser.status,
			},
		});
	} catch (error: unknown) {
		const pgError = error as { code?: string };
		if (pgError?.code === '23505') {
			return NextResponse.json({ error: 'This email address or Member ID / Handle is already registered.' }, { status: 409 });
		}
		console.error('API error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
