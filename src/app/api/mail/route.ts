import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/access';
import { getFolderMessages, getMailboxes, invalidateMailboxCache } from '@/lib/mail/imap';
import { readImapAccount } from '@/lib/mail/smtpSettings';
import { sendMail } from '@/lib/mail/mailer';
import { isValidEmail } from '@/lib/mail/address';
import { errorMessage } from '@/lib/errors';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import mailContract from '@/apps/mail/mail.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/mail
 * Query parameters:
 * - folder: e.g. "INBOX", "[Gmail]/Sent Mail" (defaults to "INBOX")
 * - page: page number (defaults to 1)
 * - limit: page size (defaults to 25)
 * - search: search term
 * - mailboxesOnly: if "true", returns only the folders list
 * - refresh: if "true", forces mailbox count refresh
 */
export async function GET(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	try {
		const url = new URL(request.url);
		const folder = url.searchParams.get('folder') || 'INBOX';
		const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
		const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
		const search = url.searchParams.get('search') || undefined;
		const mailboxesOnly = url.searchParams.get('mailboxesOnly') === 'true';
		const forceRefresh = url.searchParams.get('refresh') === 'true';

		if (mailboxesOnly) {
			const { folders, user } = await getMailboxes(forceRefresh);
			return NextResponse.json({ folders, user }, { headers: NO_STORE });
		}

		// An unconfigured account is a state of the mailbox, not a server failure: answering 200
		// keeps the browser from logging a failed request for every admin who opens the app before
		// an address is connected, and the UI renders its connection state from `configured`.
		const account = await readImapAccount();
		if (!account.user || !account.pass) {
			return NextResponse.json(
				{
					configured: false,
					error: 'Email account is not configured or app password is missing.',
					messages: [],
					total: 0,
					folders: [],
					user: '',
				},
				{ headers: NO_STORE }
			);
		}

		const messageData = await getFolderMessages(folder, page, limit, search);
		const { folders, user } = await getMailboxes(forceRefresh);

		return NextResponse.json(
			{
				folders,
				user,
				...messageData,
			},
			{ headers: NO_STORE }
		);
	} catch (error) {
		return NextResponse.json(
			{
				error: errorMessage(error) || 'Failed to fetch emails from server.',
			},
			{ status: 500, headers: NO_STORE }
		);
	}
}

/**
 * POST /api/mail
 * Sends a new email or reply.
 * Body: { to, subject, html, text?, replyToUid?, folder? }
 */
export async function POST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const limit = consumeRateLimit(`mail:send:${auth.user.id}`, 15, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Sending emails too fast. Please wait a moment.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json();
		const { to, subject, html, text } = body;

		if (!to || typeof to !== 'string') {
			return contractErrorResponse(mailContract, 'INVALID_RECIPIENT', 'A valid recipient email address is required.');
		}

		const recipients = to
			.split(',')
			.map((a: string) => a.trim())
			.filter(Boolean);
		if (recipients.length === 0 || recipients.length > 20 || !recipients.every((a: string) => isValidEmail(a))) {
			return contractErrorResponse(mailContract, 'INVALID_RECIPIENT', 'One or more recipient addresses are invalid.');
		}

		if (!subject || typeof subject !== 'string' || subject.trim().length === 0 || subject.length > mailContract.limits.maxSubjectLength) {
			return NextResponse.json({ error: `Subject must be between 1 and ${mailContract.limits.maxSubjectLength} characters.` }, { status: 400 });
		}
		if (
			!html ||
			typeof html !== 'string' ||
			html.trim().length === 0 ||
			html.length > mailContract.limits.maxBodyLength ||
			(typeof text === 'string' && text.length > mailContract.limits.maxBodyLength)
		) {
			return NextResponse.json({ error: 'Email body cannot be empty or exceed maximum length.' }, { status: 400 });
		}

		const cleanSubject = subject.replace(/[\r\n\0]+/g, ' ').trim();
		const cleanTo = recipients.join(', ');

		const result = await sendMail({
			to: cleanTo,
			subject: cleanSubject,
			html,
			text,
		});

		if (!result.success) {
			await logSystemEvent({
				service: 'mail',
				level: 'WARN',
				message: `Email delivery failed: ${cleanTo}`,
				detail: { recipient: cleanTo, topic: cleanSubject, error: result.error },
				userId: auth.user.id,
				ip,
			});
			return contractErrorResponse(
				mailContract,
				'MAIL_SEND_FAILED',
				result.error || 'Failed to queue or deliver email.'
			);
		}

		await logSystemEvent({
			service: 'mail',
			level: 'INFO',
			message: `Email sent: ${cleanTo} (${cleanSubject})`,
			detail: { recipient: cleanTo, topic: cleanSubject, messageId: result.messageId, simulated: result.simulated },
			userId: auth.user.id,
			ip,
		});

		invalidateMailboxCache();
		return NextResponse.json({
			success: true,
			messageId: result.messageId,
			simulated: result.simulated,
		});
	} catch (error) {
		return contractErrorResponse(
			mailContract,
			'MAIL_SEND_FAILED',
			errorMessage(error) || 'An error occurred while sending email.'
		);
	}
}
