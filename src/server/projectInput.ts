import type { ProjectInput } from '@/db';
import { getUserTeamIds, getTeamById, getUserById } from '@/db';
import { can, type AuthorizedUser } from '@/lib/auth/access';
import {
	PROJECT_DESCRIPTION_MAX,
	PROJECT_TITLE_MAX,
	PROJECT_SUMMARY_MAX,
	normalizeHttpUrl,
	normalizeTeknolojiler,
} from '@/lib/projects';

/**
 * Validates the editable fields of a project. With `partial`, absent fields are
 * left out of the result; otherwise title, summary and at least one link are
 * required. Returns the clean fields or the first problem, in Turkish.
 */
export async function parseProjectInput(
	body: Record<string, unknown>,
	user: AuthorizedUser,
	partial: boolean
): Promise<{ ok: true; value: Partial<ProjectInput>; error?: undefined } | { ok: false; value?: undefined; error: string }> {
	const value: Partial<ProjectInput> = {};
	const has = (k: string) => body[k] !== undefined;

	if (!partial || has('baslik')) {
		const title = typeof body.baslik === 'string' ? body.baslik.trim() : '';
		if (title.length < 3) return { ok: false, error: 'Project başlığı en az 3 karakter olmalıdır.' };
		if (title.length > PROJECT_TITLE_MAX) return { ok: false, error: `Başlık en fazla ${PROJECT_TITLE_MAX} karakter olabilir.` };
		value.baslik = title;
	}
	if (!partial || has('ozet')) {
		const ozet = typeof body.ozet === 'string' ? body.ozet.trim() : '';
		if (ozet.length < 10) return { ok: false, error: 'Kısa açıklama en az 10 karakter olmalıdır.' };
		if (ozet.length > PROJECT_SUMMARY_MAX) return { ok: false, error: `Kısa açıklama en fazla ${PROJECT_SUMMARY_MAX} karakter olabilir.` };
		value.ozet = ozet;
	}
	if (!partial || has('aciklama')) {
		const description = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
		if (description.length > PROJECT_DESCRIPTION_MAX) return { ok: false, error: `Ayrıntılı açıklama en fazla ${PROJECT_DESCRIPTION_MAX} karakter olabilir.` };
		value.aciklama = description;
	}
	for (const key of ['repoUrl', 'canliUrl'] as const) {
		if (!partial || has(key)) {
			const url = normalizeHttpUrl(body[key]);
			if (url === undefined) {
				return { ok: false, error: key === 'repoUrl' ? 'Geçerli bir depo bağlantısı girin (https://…).' : 'Geçerli bir canlı demo bağlantısı girin (https://…).' };
			}
			value[key] = url;
		}
	}
	if (!partial && !value.repoUrl && !value.canliUrl) {
		return { ok: false, error: 'Depo veya canlı demo bağlantılarından en az biri gereklidir.' };
	}
	if (!partial || has('teknolojiler')) {
		const tech = normalizeTeknolojiler(body.teknolojiler ?? []);
		if (!tech) return { ok: false, error: 'Teknolojiler bir metin listesi olmalıdır.' };
		if (!tech.length) return { ok: false, error: 'En az bir teknoloji belirtin.' };
		value.teknolojiler = tech;
	}
	if (!partial || has('teamId')) {
		const teamId = typeof body.teamId === 'string' && body.teamId ? body.teamId : null;
		if (teamId) {
			const team = await getTeamById(teamId);
			if (!team) return { ok: false, error: 'Takım bulunamadı.' };
			// A member can credit a team they belong to or lead, not any team.
			if (!can(user, 'projects', 'yonet') && team.liderId !== user.id) {
				const mine = await getUserTeamIds(user.id);
				if (!mine.includes(teamId)) return { ok: false, error: 'Projeyi yalnızca üyesi olduğunuz bir takıma bağlayabilirsiniz.' };
			}
		}
		value.teamId = teamId;
	}
	if (!partial || has('ownerTeamId')) {
		const ownerTeamId = typeof body.ownerTeamId === 'string' && body.ownerTeamId ? body.ownerTeamId : null;
		if (ownerTeamId) {
			const team = await getTeamById(ownerTeamId);
			if (!team) return { ok: false, error: 'Sahip takım bulunamadı.' };
			if (!can(user, 'projects', 'yonet') && team.liderId !== user.id) {
				const mine = await getUserTeamIds(user.id);
				if (!mine.includes(ownerTeamId)) return { ok: false, error: 'Projenin sahibi yalnızca üyesi olduğunuz bir takım olabilir.' };
			}
		}
		value.ownerTeamId = ownerTeamId;
	}
	if (!partial || has('ownerUserId')) {
		const ownerUserId = typeof body.ownerUserId === 'string' && body.ownerUserId ? body.ownerUserId : null;
		if (ownerUserId) {
			const owner = await getUserById(ownerUserId);
			if (!owner || owner.status !== 'aktif') return { ok: false, error: 'Sahip üye bulunamadı.' };
			if (!can(user, 'projects', 'yonet') && ownerUserId !== user.id) {
				return { ok: false, error: 'Bir üyeyi yalnızca kendiniz sahip olarak atayabilirsiniz.' };
			}
		}
		value.ownerUserId = ownerUserId;
	}
	return { ok: true, value };
}
