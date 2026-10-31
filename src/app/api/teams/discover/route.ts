import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getUserTeamIds, getPgPool, getTeamById, getTeamShowcase, joinTeam, leaveTeam } from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/olaylar';
import { authenticateEnrolled } from '@/lib/auth/access';
import { PENDING_APPLICATION_MAX, TEAM_LIMIT, buildApplicationNote } from '@/lib/teams';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The team showcase for onboarding: what a member who has no role yet — and so no
 * Teams app — may look at and apply to. Any signed-in member can read it; it holds
 * only what a catalogue card needs (name, field, captain, free seats), never rosters,
 * boards or other applicants' notes.
 *
 * Applications made here are always applications, even to open teams: nobody has
 * vetted this member yet, so the captain decides (and the quota is checked up front).
 */
export async function GET(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;
	try {
		const [takimlar, aktifTakimlar] = await Promise.all([getTeamShowcase(auth.user.id), getUserTeamIds(auth.user.id)]);
		return NextResponse.json(
			{
				takimlar,
				benimTakimSayim: aktifTakimlar.length,
				limitler: { takim: TEAM_LIMIT, bekleyenBasvuru: PENDING_APPLICATION_MAX },
				saltOkunur: auth.user.status === 'mezun',
			},
			{ headers: NO_STORE }
		);
	} catch (error) {
		console.error('API /api/takimlar/kesfet GET error:', error);
		return NextResponse.json({ error: 'Takımlar okunamadı.' }, { status: 500, headers: NO_STORE });
	}
}

async function handlePOST(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}

	try {
		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		const action = body?.action;
		const teamId = typeof body?.teamId === 'string' ? body.teamId : '';
		if ((action !== 'apply' && action !== 'withdraw') || !teamId) {
			return NextResponse.json({ error: 'Eksik ya da geçersiz parametreler.' }, { status: 400 });
		}

		if (action === 'withdraw') {
			// Only an application can be withdrawn here; leaving a team is the Teams app's job.
			const mine = (await getTeamShowcase(auth.user.id)).find((t) => t.id === teamId);
			if (mine?.benimDurumum !== 'basvurdu') {
				return NextResponse.json({ error: 'Geri çekilecek bir başvuru bulunamadı.' }, { status: 404 });
			}
			const r = await leaveTeam({ teamId, userId: auth.user.id });
			if (r.success) await publishEventQuiet(getPgPool(), { k: 'takim_guncellendi', teamId });
			return r.success
				? NextResponse.json({ success: true, message: r.message })
				: NextResponse.json({ error: r.message }, { status: r.status ?? 400 });
		}

		const applicationNote = buildApplicationNote(body?.uzmanliklar, body?.basvuruNotu);
		const result = await joinTeam({ teamId, userId: auth.user.id, basvuruNotu: applicationNote, basvuruZorunlu: true });
		if (!result.ok) return NextResponse.json({ error: result.message }, { status: typeof result.status === 'number' ? result.status : 400 });

		// The roster screens refresh, and the captain's bell shows the new application at once.
		const team = await getTeamById(teamId);
		await publishEventQuiet(getPgPool(), [{ k: 'takim_guncellendi', teamId }, ...notificationEvents([team?.liderId])]);
		return NextResponse.json({ success: true, status: result.status, message: result.message });
	} catch (error) {
		console.error('API /api/takimlar/kesfet POST error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'teams.discover.create', target: 'teams.discover' });
