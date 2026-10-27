import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/access';
import { getFolderMessages, getMailboxes, invalidateMailboxCache } from '@/lib/mail/imap';
import { sendMail } from '@/lib/mail/mailer';
import { isValidEmail } from '@/lib/mail/address';
import { errorMessage } from '@/lib/errors';
import { consumeRateLimit } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

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
				error: errorMessage(error) || 'E-postalar sunucudan alınırken bir hata oluştu.',
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
			{ error: 'Çok hızlı e-posta gönderiyorsunuz. Lütfen biraz bekleyin.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json();
		const { to, subject, html, text } = body;

		if (!to || typeof to !== 'string') {
			return NextResponse.json(
				{ error: 'Geçerli bir alıcı e-posta adresi belirtilmelidir.' },
				{ status: 400 }
			);
		}

		const recipients = to
			.split(',')
			.map((a: string) => a.trim())
			.filter(Boolean);
		if (recipients.length === 0 || recipients.length > 20 || !recipients.every((a: string) => isValidEmail(a))) {
			return NextResponse.json(
				{ error: 'Alıcı adreslerinden biri veya birkaçı geçersiz formatta.' },
				{ status: 400 }
			);
		}

		if (!subject || typeof subject !== 'string' || subject.trim().length === 0 || subject.length > 250) {
			return NextResponse.json({ error: 'Konu başlığı 1-250 karakter arasında olmalıdır.' }, { status: 400 });
		}
		if (!html || typeof html !== 'string' || html.trim().length === 0 || html.length > 200_000) {
			return NextResponse.json({ error: 'E-posta içeriği boş bırakılamaz veya sınırı aşamaz.' }, { status: 400 });
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
				servis: 'mail',
				seviye: 'WARN',
				mesaj: `E-posta gönderimi başarısız: ${cleanTo}`,
				detay: { alici: cleanTo, konu: cleanSubject, hata: result.error },
				userId: auth.user.id,
				ip,
			});
			return NextResponse.json(
				{ error: result.error || 'E-posta gönderilemedi.' },
				{ status: 500 }
			);
		}

		await logSystemEvent({
			servis: 'mail',
			seviye: 'INFO',
			mesaj: `E-posta gönderildi: ${cleanTo} (${cleanSubject})`,
			detay: { alici: cleanTo, konu: cleanSubject, messageId: result.messageId, simulated: result.simulated },
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
		return NextResponse.json(
			{ error: errorMessage(error) || 'E-posta gönderimi sırasında bir hata oluştu.' },
			{ status: 500 }
		);
	}
}
