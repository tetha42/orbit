import { NextResponse } from 'next/server';
import {
	addCommitteeMember,
	createCommittee,
	createCommitteeMeeting,
	deleteCommitteeMeeting,
	getCommitteeDetail,
	getUserById,
	listCommittees,
	removeCommitteeMember,
	updateCommitteeMeeting,
} from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const MEETING_STATUS = ['planned', 'held', 'cancelled'];

export async function GET(request: Request) {
	const auth = await requireApp(request, 'decisions', 'kullan');
	if (!auth.authorized) return auth.response;
	const id = new URL(request.url).searchParams.get('id');
	if (id) {
		const detail = await getCommitteeDetail(id);
		if (!detail) return bad('Komite bulunamadı.', 404);
		return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
	}
	return NextResponse.json(
		{ committees: await listCommittees() },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'decisions', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return bad('Mezunlar sadece okuma erişimine sahiptir.', 403);

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) return bad('Geçersiz istek.');
	const action = String(body.action ?? '');

	try {
		if (action === 'createCommittee') {
			const ad = String(body.ad ?? '').trim();
			const aciklama = String(body.aciklama ?? '').trim();
			if (ad.length < 3 || ad.length > 120) return bad('Komite adı 3-120 karakter olmalıdır.');
			if (aciklama.length > 2000) return bad('Açıklama en fazla 2000 karakter olabilir.');
			const committee = await createCommittee({
				ad,
				aciklama,
				kategori: 'Governance',
				quorum: Math.max(0, Math.min(100, Number(body.quorum) || 0)),
				liderId: typeof body.liderId === 'string' ? body.liderId : undefined,
				kontenjan: Math.max(1, Math.min(100, Number(body.kontenjan) || 12)),
			});
			void logSystemEvent({
				servis: 'decisions',
				seviye: 'INFO',
				mesaj: `Komite oluşturuldu: ${committee.ad}`,
				detay: { committeeId: committee.id },
				userId: auth.user.id,
			});
			return NextResponse.json({ ok: true, committee }, { status: 201 });
		}

		if (action === 'addMember') {
			const committeeId = String(body.committeeId ?? '');
			const userId = String(body.userId ?? '');
			const target = await getUserById(userId);
			if (!target) return bad('Üye bulunamadı.', 404);
			const ok = await addCommitteeMember({
				committeeId,
				userId,
				role: typeof body.role === 'string' ? body.role : undefined,
				votingRight: body.votingRight !== false,
				termStart: Number(body.termStart) || null,
				termEnd: Number(body.termEnd) || null,
			});
			if (!ok) return bad('Komite bulunamadı.', 404);
			return NextResponse.json({ ok: true });
		}

		if (action === 'removeMember') {
			const ok = await removeCommitteeMember(String(body.committeeId ?? ''), String(body.userId ?? ''));
			if (!ok) return bad('Komite üyesi bulunamadı.', 404);
			return NextResponse.json({ ok: true });
		}

		if (action === 'createMeeting') {
			const committeeId = String(body.committeeId ?? '');
			if (!(await getCommitteeDetail(committeeId))) return bad('Komite bulunamadı.', 404);
			const title = String(body.title ?? '').trim();
			if (title.length < 3 || title.length > 160) return bad('Toplantı başlığı 3-160 karakter olmalıdır.');
			const date = Number(body.date);
			if (!Number.isFinite(date) || date <= 0) return bad('Geçersiz toplantı tarihi.');
			const meeting = await createCommitteeMeeting({
				committeeId,
				title,
				date,
				agenda: typeof body.agenda === 'string' ? body.agenda.slice(0, 5000) : '',
				minutes: typeof body.minutes === 'string' ? body.minutes.slice(0, 20000) : '',
				status: MEETING_STATUS.includes(String(body.status)) ? String(body.status) : 'planned',
				createdBy: auth.user.id,
			});
			return NextResponse.json({ ok: true, meeting }, { status: 201 });
		}

		if (action === 'updateMeeting') {
			const id = String(body.id ?? '');
			const date = body.date === undefined ? undefined : Number(body.date);
			if (date !== undefined && (!Number.isFinite(date) || date <= 0)) return bad('Geçersiz toplantı tarihi.');
			const ok = await updateCommitteeMeeting(id, {
				title: typeof body.title === 'string' ? body.title.trim().slice(0, 160) : undefined,
				date,
				agenda: typeof body.agenda === 'string' ? body.agenda.slice(0, 5000) : undefined,
				minutes: typeof body.minutes === 'string' ? body.minutes.slice(0, 20000) : undefined,
				status:
					typeof body.status === 'string' && MEETING_STATUS.includes(body.status)
						? body.status
						: undefined,
			});
			if (!ok) return bad('Toplantı bulunamadı.', 404);
			return NextResponse.json({ ok: true });
		}

		if (action === 'deleteMeeting') {
			const ok = await deleteCommitteeMeeting(String(body.id ?? ''));
			if (!ok) return bad('Toplantı bulunamadı.', 404);
			return NextResponse.json({ ok: true });
		}

		return bad('Geçersiz komite işlemi.');
	} catch (error) {
		console.error('API /api/committees POST error:', error);
		return bad('Komite işlemi tamamlanamadı.', 500);
	}
}
