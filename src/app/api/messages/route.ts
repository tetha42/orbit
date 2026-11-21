import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { createMailThread, getMailThreads, getUnreadMailCount } from '@/db/messages';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';
import { recipientDecision, notifyByEmail } from '@/server/messages';
import {
	skippedReason,
	MAIL_RECIPIENT_MAX,
	MAIL_PER_MINUTE_LIMIT,
	MAIL_BODY_MAX,
	MAIL_FOLDERS,
	MAIL_SUBJECT_MAX,
	MAIL_PAGE_SIZE,
	type MailSendResult,
	type MailFolder,
	type MailConversationList,
} from '@/lib/messages';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** One folder of the caller's own conversations, a page at a time. */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'mail', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const params = new URL(request.url).searchParams;
		const folder = (params.get('folder') ?? 'inbox') as MailFolder;
		if (!MAIL_FOLDERS.includes(folder)) return NextResponse.json({ error: 'Invalid folder.' }, { status: 400, headers: NO_STORE });
		const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);
		const [list, unreadCount] = await Promise.all([
			getMailThreads(auth.user.id, folder, page),
			getUnreadMailCount(auth.user.id),
		]);
		const body: MailConversationList = { folder: folder, ...list, page: page, pageSize: MAIL_PAGE_SIZE, now: Date.now(), unread: unreadCount };
		return NextResponse.json(body, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/messages GET error:', error);
		return NextResponse.json({ error: 'Failed to load mail.' }, { status: 500, headers: NO_STORE });
	}
}

/**
 * Starts a conversation with one or more members. Recipients must be active members
 * whose role opens Mail; the others are reported back (`skipped`) and the
 * message goes to the rest — or, when nobody can be reached, nowhere (422).
 */
async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'mail', 'use');
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	try {
		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
		const messageBody = typeof body?.body === 'string' ? body.body.trim() : '';
		const rawRecipients = body?.recipients;
		const recipients = Array.isArray(rawRecipients) ? rawRecipients.filter((x): x is string => typeof x === 'string') : [];
		if (!subject || subject.length > MAIL_SUBJECT_MAX) {
			return NextResponse.json({ error: `Subject must be between 1 and ${MAIL_SUBJECT_MAX} characters.` }, { status: 400 });
		}
		if (!messageBody || messageBody.length > MAIL_BODY_MAX) {
			return NextResponse.json({ error: `Message must be between 1 and ${MAIL_BODY_MAX} characters.` }, { status: 400 });
		}
		const ids = [...new Set(recipients)].filter((id) => id !== user.id);
		if (ids.length === 0) return NextResponse.json({ error: 'Select at least one recipient (you cannot message yourself).' }, { status: 400 });
		if (ids.length > MAIL_RECIPIENT_MAX) return NextResponse.json({ error: `At most ${MAIL_RECIPIENT_MAX} recipients may be selected.` }, { status: 400 });

		const limit = consumeRateLimit(`messages:${user.id}`, MAIL_PER_MINUTE_LIMIT, 60_000);
		if (!limit.allowed) {
			return NextResponse.json(
				{ error: 'You are sending messages too fast. Please wait a moment.', code: 'MAIL_RATE_LIMITED' },
				{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
			);
		}

		const decision = await recipientDecision(user.id, ids, true);
		if (decision.error) return NextResponse.json({ error: decision.error }, { status: 400 });
		const { outgoing, skipped } = decision;
		if (outgoing.length === 0) {
			return NextResponse.json({ error: skipped.map(skippedReason).join(' '), skipped: skipped }, { status: 422 });
		}

		const { topicId, messageId } = await createMailThread(user.id, subject, messageBody, outgoing.map((u) => u.id));
		notifyByEmail(outgoing, user, subject);
		const result: MailSendResult = {
			threadId: topicId,
			messageId: messageId,
			skipped: skipped,
		};
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error('API /api/messages POST error:', error);
		return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'messages.create', target: 'messages' });
