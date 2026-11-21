import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { addMailReply, getMailParticipantIds, getMailThread, setMailThreadStatus } from '@/db/messages';
import { getPgPool } from '@/db';
import { publishEventQuiet } from '@/db/events';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';
import { recipientDecision, notifyByEmail } from '@/server/messages';
import { skippedReason, MAIL_PER_MINUTE_LIMIT, MAIL_BODY_MAX, MAIL_ACTIONS, type MailSendResult, type MailAction } from '@/lib/messages';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
/** Somebody else's conversation and one that does not exist look the same, so its existence is not given away. */
const notFound = () => NextResponse.json({ error: 'Conversation not found.' }, { status: 404, headers: NO_STORE });

/** The conversation, if the caller is part of it. Reading does not mark it read; PATCH `read` does. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'mail', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const { id } = await params;
		const subject = await getMailThread(auth.user.id, id);
		if (!subject) return notFound();
		return NextResponse.json(subject, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/messages/[id] GET error:', error);
		return NextResponse.json({ error: 'Failed to load conversation.' }, { status: 500, headers: NO_STORE });
	}
}

/** Replies to everyone in the conversation. */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'mail', 'use');
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	try {
		const { id } = await params;
		const subject = await getMailThread(user.id, id);
		if (!subject) return notFound();

		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		const rawBody = typeof body?.body === 'string' ? body.body : '';
		const messageBody = rawBody.trim();
		if (!messageBody || messageBody.length > MAIL_BODY_MAX) {
			return NextResponse.json({ error: `Message must be between 1 and ${MAIL_BODY_MAX} characters.` }, { status: 400 });
		}
		const limit = consumeRateLimit(`messages:${user.id}`, MAIL_PER_MINUTE_LIMIT, 60_000);
		if (!limit.allowed) {
			return NextResponse.json(
				{ error: 'You are sending messages too fast. Please wait a moment.', code: 'MAIL_RATE_LIMITED' },
				{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
			);
		}

		const decision = await recipientDecision(user.id, await getMailParticipantIds(id), false);
		if (decision.error) return NextResponse.json({ error: decision.error }, { status: 400 });
		const { outgoing, skipped } = decision;
		// Everyone else has left or lost Mail: the reply would reach nobody.
		if (outgoing.length === 0) {
			return NextResponse.json({ error: skipped.map(skippedReason).join(' ') || 'No recipients left for this reply.', skipped: skipped }, { status: 422 });
		}

		const messageId = await addMailReply(id, user.id, messageBody, outgoing.map((u) => u.id));
		notifyByEmail(outgoing, user, subject.topic);
		const result: MailSendResult = { threadId: id, messageId, skipped: skipped };
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error('API /api/messages/[id] POST error:', error);
		return NextResponse.json({ error: 'Failed to send reply.' }, { status: 500 });
	}
}

const ACTION_MAP: Record<string, MailAction> = {
	read: 'read',
	unread: 'unread',
	archive: 'archive',
	inbox: 'restore',
	trash: 'trash',
	delete: 'delete',
	restore: 'restore',
};

/** `{ action }`: read, unread, archive, inbox, trash, delete, restore (caller only). */
async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'mail', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const { id } = await params;
		const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
		const rawAction = typeof body?.action === 'string' ? body.action : '';
		const action = ACTION_MAP[rawAction];
		if (!action || !MAIL_ACTIONS.includes(action)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
		const subject = await getMailThread(auth.user.id, id);
		if (!subject) return notFound();
		if (action === 'delete' && subject.folder !== 'trash') {
			return NextResponse.json({ error: 'Conversation must be in Trash before permanent deletion.' }, { status: 400 });
		}
		await setMailThreadStatus(auth.user.id, id, action);
		// The Dock badge and the bell's unread count are derived from the notification feed.
		await publishEventQuiet(getPgPool(), { k: 'notification', userId: auth.user.id });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/messages/[id] PATCH error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'messages.item.create', target: 'messages.item' });
export const PATCH = withAudit(handlePATCH, { action: 'messages.item.update', target: 'messages.item' });
