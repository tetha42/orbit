import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import {
	getTeams,
	getTeamCategories,
	getTeamMembers,
	getTeamTasks,
	joinTeam,
	leaveTeam,
	createTeamTask,
	updateTeamTaskStatus,
	createTeam,
	deleteTeam,
	deleteTeamTask,
	decideTeamApplication,
	getUserById,
	setTeamMemberRole,
	updateTeam,
	getPgPool,
	type TeamPatch,
} from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import {
	APPLICATION_NOTE_MAX,
	CAPTAIN_ROLE,
	TEAM_DESCRIPTION_MAX,
	TEAM_NAME_MAX,
	isParticipationType,
	isTeamStatus,
	capacityProblem,
	normalizeRole,
} from '@/lib/teams';
import { normalizeHttpUrl } from '@/lib/projects';
import { can, requireApp } from '@/lib/auth/access';
import {
	DESCRIPTION_MAX,
	TITLE_MAX,
	TASK_STATUSES,
	SIRALAMA_MAX,
	normalizeStatus,
	normalizeEtiketler,
	normalizeOncelik,
	normalizeDueDate,
} from '@/lib/kanban';
import { getBoardAccess, getTaskAccess, isAssignable } from '@/lib/server/taskAccess';

export async function GET(request: Request) {
	// Team composition and task lists are internal to the club.
	const auth = await requireApp(request, 'teams', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		const teamId = searchParams.get('teamId');

		const teams = await getTeams();

		const enrichedTeams = await Promise.all(
			teams.map(async (team) => {
				const tumu = await getTeamMembers(team.id);
				const aktif = tumu.filter((u) => u.status === 'aktif');
				const manage = can(auth.user, 'teams', 'yonet') || team.liderId === auth.user.id;
				// A team's task board belongs to the team: management, its leader and its
				// active members. Everyone else sees the team card, not the work items.
				const canSeeTasks = manage || aktif.some((u) => u.userId === auth.user.id);
				const tasks = canSeeTasks ? await getTeamTasks(team.id) : [];
				const benim = tumu.find((u) => u.userId === auth.user.id);
				return {
					...team,
					katilimTuru: team.katilimTuru ?? 'acik',
					// The roster is active members only; applications are for whoever decides on them.
					uyeler: aktif,
					basvurular: manage ? tumu.filter((u) => u.status === 'basvurdu') : [],
					benimDurumum: benim?.status ?? null,
					izinler: { manage, editAll: can(auth.user, 'teams', 'yonet') },
					gorevler: tasks,
					doluKontenjan: aktif.length,
					kalanKontenjan: Math.max(0, team.kontenjan - aktif.length),
					dolulukOrani: Math.min(100, Math.round((aktif.length / team.kontenjan) * 100)),
				};
			})
		);

		if (teamId) {
			const found = enrichedTeams.find((t) => t.id === teamId || t.slug === teamId);
			if (!found) return NextResponse.json({ error: 'Takım bulunamadı' }, { status: 404 });
			return NextResponse.json(found);
		}

		return NextResponse.json(enrichedTeams);
	} catch (error) {
		console.error('API /api/takimlar GET error:', error);
		return NextResponse.json({ error: 'Takımlar okunamadı.' }, { status: 500 });
	}
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'teams', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { action } = body;

		const teamId: string = typeof body.teamId === 'string' ? body.teamId : '';
		const graduate = auth.user.status === 'mezun';

		if (action === 'join') {
			if (graduate) return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
			if (!teamId) return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
			const note = typeof body.basvuruNotu === 'string' ? body.basvuruNotu.trim().slice(0, APPLICATION_NOTE_MAX) : null;
			const result = await joinTeam({ teamId, userId: auth.user.id, basvuruNotu: note });
			if (result.ok) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
			return result.ok
				? NextResponse.json({ success: true, status: result.status, message: result.message })
				: NextResponse.json({ error: result.message }, { status: typeof result.status === 'number' ? result.status : 400 });
		}

		if (action === 'leave') {
			if (!teamId) return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 });
			const result = await leaveTeam({ teamId, userId: auth.user.id });
			if (result.success) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
			return result.success
				? NextResponse.json({ success: true, message: result.message })
				: NextResponse.json({ error: result.message }, { status: result.status ?? 400 });
		}

		// Roster and team settings: the captain, or management.
		if (['approve', 'reject', 'setMemberRole', 'removeMember', 'addMember', 'updateTeam'].includes(action)) {
			if (graduate) return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
			const board = teamId ? await getBoardAccess(auth.user, teamId) : null;
			if (!board) return NextResponse.json({ error: 'Takım bulunamadı.' }, { status: 404 });
			if (!board.manage) {
				return NextResponse.json({ error: 'Bu işlem takım kaptanına veya yönetime aittir.' }, { status: 403 });
			}
			const userId: string = typeof body.userId === 'string' ? body.userId : '';

			if (action === 'approve' || action === 'reject') {
				if (!userId) return NextResponse.json({ error: 'Üye belirtilmedi.' }, { status: 400 });
				const r = await decideTeamApplication({ teamId, userId, accept: action === 'approve' });
				// The applicant hears it at once: their open screens re-read the team list, and their bell the feed.
				if (r.success) await publishEventQuiet(getPgPool(), [{ k: 'team_updated', teamId }, ...notificationEvents([userId])]);
				return r.success
					? NextResponse.json({ success: true, message: r.message })
					: NextResponse.json({ error: r.message }, { status: r.status ?? 400 });
			}

			if (action === 'setMemberRole') {
				const role = normalizeRole(body.takimRolu);
				if (!role) return NextResponse.json({ error: 'Role boş olamaz.' }, { status: 400 });
				if (userId === board.team.liderId && role !== CAPTAIN_ROLE) {
					return NextResponse.json({ error: 'Kaptanın unvanı kaptanlık devredilerek değişir.' }, { status: 409 });
				}
				const ok = await setTeamMemberRole(teamId, userId, role);
				if (ok) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
				return ok
					? NextResponse.json({ success: true, message: 'Role güncellendi.' })
					: NextResponse.json({ error: 'Aktif üye bulunamadı.' }, { status: 404 });
			}

			if (action === 'removeMember') {
				if (!userId) return NextResponse.json({ error: 'Üye belirtilmedi.' }, { status: 400 });
				const r = await leaveTeam({ teamId, userId, aktorId: auth.user.id });
				if (r.success) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
				return r.success
					? NextResponse.json({ success: true, message: 'Üye takımdan çıkarıldı.' })
					: NextResponse.json({ error: r.message }, { status: r.status ?? 400 });
			}

			if (action === 'addMember') {
				// Management only: placing someone on a team without an application.
				if (!can(auth.user, 'teams', 'yonet')) {
					return NextResponse.json({ error: 'Üye eklemek yönetime aittir.' }, { status: 403 });
				}
				if (!userId) return NextResponse.json({ error: 'Üye belirtilmedi.' }, { status: 400 });
				const r = await joinTeam({ teamId, userId, direct: true, takimRolu: normalizeRole(body.takimRolu) ?? undefined });
				if (r.ok) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
				return r.ok
					? NextResponse.json({ success: true, message: 'Üye takıma eklendi.' })
					: NextResponse.json({ error: r.message }, { status: typeof r.status === 'number' ? r.status : 400 });
			}

			// action === 'updateTeam'. The captain runs the team day to day; renaming,
			// re-filing, pausing it or handing it to someone else is management's call.
			const editAll = can(auth.user, 'teams', 'yonet');
			const patch: TeamPatch = {};
			const restricted = ['ad', 'kategori', 'status', 'liderId'].filter((k) => body[k] !== undefined);
			if (restricted.length && !editAll) {
				return NextResponse.json({ error: 'Ad, kategori, status ve kaptan yalnızca yönetim tarafından değiştirilebilir.' }, { status: 403 });
			}
			if (body.ad !== undefined) {
				const ad = typeof body.ad === 'string' ? body.ad.trim() : '';
				if (ad.length < 3 || ad.length > TEAM_NAME_MAX) return NextResponse.json({ error: 'Takım adı 3-90 karakter olmalıdır.' }, { status: 400 });
				patch.ad = ad;
			}
			if (body.aciklama !== undefined) {
				const description = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
				if (description.length < 10 || description.length > TEAM_DESCRIPTION_MAX) {
					return NextResponse.json({ error: 'Açıklama 10-1200 karakter olmalıdır.' }, { status: 400 });
				}
				patch.aciklama = description;
			}
			if (body.kategori !== undefined) {
				const categories = await getTeamCategories();
				if (typeof body.kategori !== 'string' || (!categories.includes(body.kategori) && body.kategori !== board.team.kategori)) {
					return NextResponse.json({ error: 'Geçersiz kategori.' }, { status: 400 });
				}
				patch.kategori = body.kategori;
			}
			if (body.kontenjan !== undefined) {
				const err = capacityProblem(body.kontenjan, board.uyeler.filter((u) => u.status === 'aktif').length);
				if (err) return NextResponse.json({ error: err }, { status: 400 });
				patch.kontenjan = Number(body.kontenjan);
			}
			if (body.repoUrl !== undefined) {
				const url = normalizeHttpUrl(body.repoUrl);
				if (url === undefined) return NextResponse.json({ error: 'Geçerli bir depo bağlantısı girin (https://…).' }, { status: 400 });
				patch.repoUrl = url;
			}
			if (body.status !== undefined) {
				if (!isTeamStatus(body.status)) return NextResponse.json({ error: 'Geçersiz status.' }, { status: 400 });
				patch.status = body.status;
			}
			if (body.katilimTuru !== undefined) {
				if (!isParticipationType(body.katilimTuru)) return NextResponse.json({ error: 'Geçersiz katılım türü.' }, { status: 400 });
				patch.katilimTuru = body.katilimTuru;
			}
			if (body.liderId !== undefined) {
				const leader = typeof body.liderId === 'string' ? await getUserById(body.liderId) : null;
				if (!leader || leader.status !== 'aktif') return NextResponse.json({ error: 'Kaptan olarak seçilen üye bulunamadı.' }, { status: 400 });
				patch.liderId = leader.id;
			}
			await updateTeam(teamId, patch);
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
			return NextResponse.json({ success: true, message: 'Takım güncellendi.' });
		}

		// Graduates keep read access only.
		const taskWrite = ['addTask', 'updateTask', 'moveTask', 'deleteTask'].includes(action);
		if (taskWrite && auth.user.status === 'mezun') {
			return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
		}

		if (action === 'addTask') {
			const { teamId, baslik, aciklama, oncelik, atananUyeId, teslimTarihi, etiketler, status } = body;
			const title = typeof baslik === 'string' ? baslik.trim() : '';
			if (!teamId || !title) {
				return NextResponse.json({ error: 'Takım ID ve Başlık zorunludur.' }, { status: 400 });
			}
			if (title.length > TITLE_MAX) {
				return NextResponse.json({ error: `Başlık en fazla ${TITLE_MAX} karakter olabilir.` }, { status: 400 });
			}
			if (typeof aciklama === 'string' && aciklama.length > DESCRIPTION_MAX) {
				return NextResponse.json({ error: `Açıklama en fazla ${DESCRIPTION_MAX} karakter olabilir.` }, { status: 400 });
			}
			// Creating assignments is a management action or team captain action.
			const board = await getBoardAccess(auth.user, teamId);
			if (!board) {
				return NextResponse.json({ error: 'Takım bulunamadı.' }, { status: 404 });
			}
			if (!board.manage) {
				return NextResponse.json(
					{ error: 'Bu işlem için topluluk yönetimi veya takım kaptanı yetkisi gereklidir.' },
					{ status: 403 }
				);
			}
			const priority = oncelik === undefined ? 'orta' : normalizeOncelik(oncelik);
			if (!priority) {
				return NextResponse.json({ error: 'Geçersiz öncelik.' }, { status: 400 });
			}
			const column = status === undefined ? 'yapilacak' : normalizeStatus(status);
			if (!column) {
				return NextResponse.json({ error: 'Geçersiz status.' }, { status: 400 });
			}
			const due = teslimTarihi === undefined ? null : normalizeDueDate(teslimTarihi);
			if (due === undefined) {
				return NextResponse.json({ error: 'Geçersiz teslim tarihi.' }, { status: 400 });
			}
			const labels = etiketler === undefined ? [] : normalizeEtiketler(etiketler);
			if (!labels) {
				return NextResponse.json({ error: 'Etiketler bir metin listesi olmalıdır.' }, { status: 400 });
			}
			// An empty assignee leaves the task in the team's pool for anyone to pick up.
			const assignee = typeof atananUyeId === 'string' && atananUyeId ? atananUyeId : undefined;
			if (assignee && !isAssignable(board, assignee)) {
				return NextResponse.json({ error: 'Görev yalnızca takım üyelerine atanabilir.' }, { status: 400 });
			}
			const task = await createTeamTask({
				teamId,
				baslik: title,
				aciklama: typeof aciklama === 'string' ? aciklama : '',
				oncelik: priority,
				atananUyeId: assignee,
				teslimTarihi: due ?? undefined,
				etiketler: labels,
				status: column,
				olusturanId: auth.user.id,
			});
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
			return NextResponse.json({ success: true, task });
		}

		if (action === 'updateTask' || action === 'moveTask') {
			const { gorevId, status, sira, sirala } = body;
			if (!gorevId) {
				return NextResponse.json({ error: 'Görev ID zorunludur.' }, { status: 400 });
			}
			// Reject unknown states instead of persisting a value no client can filter on.
			const normalized = normalizeStatus(status);
			if (!normalized) {
				return NextResponse.json(
					{ error: `Geçersiz status. Beklenen: ${TASK_STATUSES.join(', ')}` },
					{ status: 400 }
				);
			}
			if (sira !== undefined && (typeof sira !== 'number' || !Number.isFinite(sira))) {
				return NextResponse.json({ error: 'Geçersiz sıra.' }, { status: 400 });
			}
			if (
				sirala !== undefined &&
				(!Array.isArray(sirala) ||
					sirala.length > SIRALAMA_MAX ||
					!sirala.every((id: unknown) => typeof id === 'string'))
			) {
				return NextResponse.json({ error: 'Geçersiz sıralama.' }, { status: 400 });
			}
			// Who may move a card is decided from the stored task, never from the
			// request: management, the team's leader, or the person it is assigned to.
			const access = await getTaskAccess(auth.user, gorevId);
			if (!access) {
				return NextResponse.json({ error: 'Görev bulunamadı.' }, { status: 404 });
			}
			if (!access.work) {
				return NextResponse.json(
					{ error: 'Bu görevin durumunu yalnızca yönetim, takım kaptanı veya görevi üstlenen üye değiştirebilir.' },
					{ status: 403 }
				);
			}
			const result = await updateTeamTaskStatus({
				gorevId,
				status: normalized,
				sira,
				sirala,
				aktorId: auth.user.id,
			});
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
			return NextResponse.json({ success: true, status: normalized, xpVerildi: result.xpVerildi });
		}

		if (action === 'createTeam') {
			if (!can(auth.user, 'teams', 'yonet')) {
				return NextResponse.json(
					{ error: 'Takım oluşturma yetkisi yalnızca yönetim kurulundadır.' },
					{ status: 403 }
				);
			}
			const { ad, kategori, aciklama, kontenjan, repoUrl, liderId, katilimTuru } = body;
			if (!ad || !kategori || !aciklama) {
				return NextResponse.json(
					{ error: 'Takım adı, kategori ve açıklama zorunludur.' },
					{ status: 400 }
				);
			}
			const categories = await getTeamCategories();
			if (typeof kategori !== 'string' || !categories.includes(kategori)) {
				return NextResponse.json({ error: 'Geçersiz kategori.' }, { status: 400 });
			}
			const quotaError = capacityProblem(kontenjan ?? 6, 0);
			if (quotaError) return NextResponse.json({ error: quotaError }, { status: 400 });
			const repo = normalizeHttpUrl(repoUrl);
			if (repo === undefined) return NextResponse.json({ error: 'Geçerli bir depo bağlantısı girin (https://…).' }, { status: 400 });
			const newTeam = await createTeam({
				ad,
				kategori,
				aciklama,
				kontenjan: Number(kontenjan ?? 6),
				repoUrl: repo ?? undefined,
				liderId,
				katilimTuru: isParticipationType(katilimTuru) ? katilimTuru : 'acik',
			});
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: newTeam.id });
			return NextResponse.json({ success: true, team: newTeam });
		}

		if (action === 'deleteTeam') {
			if (!can(auth.user, 'teams', 'yonet')) {
				return NextResponse.json(
					{ error: 'Takım silme yetkisi yalnızca yönetim kurulundadır.' },
					{ status: 403 }
				);
			}
			const { teamId } = body;
			if (!teamId) {
				return NextResponse.json({ error: 'Takım ID zorunludur.' }, { status: 400 });
			}
			let deleted: boolean;
			try {
				deleted = await deleteTeam(teamId);
			} catch (err) {
				// butce_kayitlari references takimlar with ON DELETE RESTRICT: a project
				// that has money records cannot be deleted out from under them.
				if ((err as { code?: string })?.code === '23503') {
					return NextResponse.json(
						{ error: 'Bu projenin kasa kayıtları var. Önce kasa kayıtlarını silin.' },
						{ status: 409 }
					);
				}
				throw err;
			}
			if (!deleted) {
				return NextResponse.json({ error: 'Takım bulunamadı veya silinemedi.' }, { status: 404 });
			}
			await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId });
			return NextResponse.json({ success: true, message: 'Takım silindi.' });
		}

		if (action === 'deleteTask') {
			const { gorevId } = body;
			if (!gorevId) {
				return NextResponse.json({ error: 'Görev ID zorunludur.' }, { status: 400 });
			}
			// The team comes from the stored task. Trusting a `teamId` from the body
			// let the captain of one team delete tasks of any other team.
			const access = await getTaskAccess(auth.user, gorevId);
			if (!access) {
				return NextResponse.json({ error: 'Görev bulunamadı.' }, { status: 404 });
			}
			if (!access.manage) {
				return NextResponse.json(
					{ error: 'Görevi silmek için topluluk yönetimi veya takım kaptanı olmalısınız.' },
					{ status: 403 }
				);
			}
			const deleted = await deleteTeamTask(gorevId);
			if (deleted) await publishEventQuiet(getPgPool(), { k: 'team_updated', teamId: access.task.teamId });
			return NextResponse.json({ success: true, deleted });
		}

		return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
	} catch (error) {
		console.error('API /api/takimlar POST error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'teams.create', target: 'teams' });
