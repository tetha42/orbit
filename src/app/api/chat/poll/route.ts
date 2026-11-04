import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { canUserAccessChatRoom, createPollInRoom, castPollVote, closePoll } from '@/db/repositories/chat.repo';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { clientAddress } from '@/lib/http';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');

	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'create') {
			if (!isAdmin) {
				return NextResponse.json(
					{ error: 'Yalnızca yöneticiler anket oluşturabilir.' },
					{ status: 403, headers: NO_CACHE }
				);
			}

			const { roomId, question, options, multipleSelection, anonymous, endsAt } = body;

			if (!roomId || !question || typeof question !== 'string' || !question.trim()) {
				return NextResponse.json(
					{ error: 'Anket sorusu boş olamaz.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const canAccess = await canUserAccessChatRoom(String(roomId), auth.user.id, isAdmin);
			if (!canAccess) {
				return NextResponse.json(
					{ error: 'Bu sohbet odasına erişim yetkiniz yok.' },
					{ status: 403, headers: NO_CACHE }
				);
			}

			if (!Array.isArray(options) || options.length < 2 || options.length > 12) {
				return NextResponse.json(
					{ error: 'Ankette en az 2, en fazla 12 seçenek belirtilmelidir.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await createPollInRoom(
				roomId,
				{
					id: auth.user.id,
					name: auth.user.name,
					surname: auth.user.surname,
					profilePhoto: auth.user.profilePhoto || null,
				},
				{
					question: question.trim().slice(0, 500),
					options: options.map((s: unknown) => String(s ?? '').slice(0, 200)),
					multipleSelection: Boolean(multipleSelection),
					anonymous: anonymous !== false,
					endsAt: typeof endsAt === 'number' ? endsAt : null,
				}
			);

			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Anket oluşturulamadı.' }, { status: 400, headers: NO_CACHE });
			}

			void logSystemEvent({
				service: 'chat',
				level: 'INFO',
				message: `Yeni anket oluşturuldu: "${question.trim().slice(0, 50)}" (${roomId})`,
				detail: { roomId, pollId: res.message?.poll?.id, question: question.trim().slice(0, 120) },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		if (action === 'vote') {
			const { pollId, optionId } = body;
			if (!pollId || !optionId) {
				return NextResponse.json(
					{ error: 'Anket veya seçenek kimliği belirtilmedi.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await castPollVote(
				String(pollId),
				String(optionId),
				{
					id: auth.user.id,
					name: auth.user.name,
					surname: auth.user.surname,
					profilePhoto: auth.user.profilePhoto || null,
				},
				isAdmin
			);

			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Oy kullanılamadı.' }, { status: 400, headers: NO_CACHE });
			}

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		if (action === 'close') {
			const { pollId } = body;
			if (!pollId) {
				return NextResponse.json(
					{ error: 'Anket kimliği belirtilmedi.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await closePoll(pollId, auth.user.id, isAdmin);
			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Anket kapatılamadı.' }, { status: 400, headers: NO_CACHE });
			}

			void logSystemEvent({
				service: 'chat',
				level: 'INFO',
				message: `Anket sonlandırıldı: ${pollId}`,
				detail: { pollId },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400, headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat poll POST error]:', err);
		return NextResponse.json({ error: 'İşlem sırasında bir hata oluştu.' }, { status: 500, headers: NO_CACHE });
	}
}
