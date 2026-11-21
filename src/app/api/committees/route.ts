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
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const MEETING_STATUS = ['planned', 'held', 'cancelled'];

export async function GET(request: Request) {
	const auth = await requireApp(request, 'decisions', 'use');
	if (!auth.authorized) return auth.response;
	const id = new URL(request.url).searchParams.get('id');
	if (id) {
		const detail = await getCommitteeDetail(id);
		if (!detail) return bad('Committee not found.', 404);
		return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
	}
	return NextResponse.json(
		{ committees: await listCommittees() },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'decisions', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') return bad('Alumni accounts have read-only access.', 403);

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) return bad('Invalid request.');
	const action = String(body.action ?? '');

	try {
		if (action === 'createCommittee') {
			const name = String(body.name ?? '').trim();
			const description = String(body.description ?? '').trim();
			if (name.length < 3 || name.length > 120) return bad('Committee name must be 3–120 characters.');
			if (description.length > 2000) return bad('Description may be at most 2000 characters.');
			const committee = await createCommittee({
				name,
				description,
				category: 'Governance',
				quorum: Math.max(0, Math.min(100, Number(body.quorum) || 0)),
				leadId: typeof body.leadId === 'string' ? body.leadId : undefined,
				capacity: Math.max(1, Math.min(100, Number(body.capacity) || 12)),
			});
			void logSystemEvent({
				service: 'decisions',
				level: 'INFO',
				message: `Committee created: ${committee.name}`,
				detail: { committeeId: committee.id },
				userId: auth.user.id,
			});
			return NextResponse.json({ ok: true, committee }, { status: 201 });
		}

		if (action === 'addMember') {
			const committeeId = String(body.committeeId ?? '');
			const userId = String(body.userId ?? '');
			const target = await getUserById(userId);
			if (!target) return bad('Member not found.', 404);
			const ok = await addCommitteeMember({
				committeeId,
				userId,
				role: typeof body.role === 'string' ? body.role : undefined,
				votingRight: body.votingRight !== false,
				termStart: Number(body.termStart) || null,
				termEnd: Number(body.termEnd) || null,
			});
			if (!ok) return bad('Committee not found.', 404);
			return NextResponse.json({ ok: true });
		}

		if (action === 'removeMember') {
			const ok = await removeCommitteeMember(String(body.committeeId ?? ''), String(body.userId ?? ''));
			if (!ok) return bad('Committee member not found.', 404);
			return NextResponse.json({ ok: true });
		}

		if (action === 'createMeeting') {
			const committeeId = String(body.committeeId ?? '');
			if (!(await getCommitteeDetail(committeeId))) return bad('Committee not found.', 404);
			const title = String(body.title ?? '').trim();
			if (title.length < 3 || title.length > 160) return bad('Meeting title must be 3–160 characters.');
			const date = Number(body.date);
			if (!Number.isFinite(date) || date <= 0) return bad('Invalid meeting date.');
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
			if (date !== undefined && (!Number.isFinite(date) || date <= 0)) return bad('Invalid meeting date.');
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
			if (!ok) return bad('Meeting not found.', 404);
			return NextResponse.json({ ok: true });
		}

		if (action === 'deleteMeeting') {
			const ok = await deleteCommitteeMeeting(String(body.id ?? ''));
			if (!ok) return bad('Meeting not found.', 404);
			return NextResponse.json({ ok: true });
		}

		return bad('Invalid committee action.');
	} catch (error) {
		console.error('API /api/committees POST error:', error);
		return bad('Committee action could not be completed.', 500);
	}
}
