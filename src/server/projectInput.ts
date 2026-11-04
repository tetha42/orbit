import type { ProjectInput } from '@/db';
import { getUserTeamIds, getTeamById, getUserById } from '@/db';
import { can, type AuthorizedUser } from '@/lib/auth/access';
import {
	PROJECT_DESCRIPTION_MAX,
	PROJECT_TITLE_MAX,
	PROJECT_SUMMARY_MAX,
	normalizeHttpUrl,
	normalizeTechnologies,
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

	if (!partial || has('title')) {
		const title = typeof body.title === 'string' ? body.title.trim() : '';
		if (title.length < 3) return { ok: false, error: 'Project başlığı en az 3 karakter olmalıdır.' };
		if (title.length > PROJECT_TITLE_MAX) return { ok: false, error: `Başlık en fazla ${PROJECT_TITLE_MAX} karakter olabilir.` };
		value.title = title;
	}
	if (!partial || has('summary')) {
		const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
		if (summary.length < 10) return { ok: false, error: 'Kısa açıklama en az 10 karakter olmalıdır.' };
		if (summary.length > PROJECT_SUMMARY_MAX) return { ok: false, error: `Kısa açıklama en fazla ${PROJECT_SUMMARY_MAX} karakter olabilir.` };
		value.summary = summary;
	}
	if (!partial || has('description')) {
		const description = typeof body.description === 'string' ? body.description.trim() : '';
		if (description.length > PROJECT_DESCRIPTION_MAX) return { ok: false, error: `Ayrıntılı açıklama en fazla ${PROJECT_DESCRIPTION_MAX} karakter olabilir.` };
		value.description = description;
	}
	for (const key of ['repoUrl', 'liveUrl'] as const) {
		if (!partial || has(key)) {
			const url = normalizeHttpUrl(body[key]);
			if (url === undefined) {
				return { ok: false, error: key === 'repoUrl' ? 'Geçerli bir depo bağlantısı girin (https://…).' : 'Geçerli bir canlı demo bağlantısı girin (https://…).' };
			}
			value[key] = url;
		}
	}
	if (!partial && !value.repoUrl && !value.liveUrl) {
		return { ok: false, error: 'Depo veya canlı demo bağlantılarından en az biri gereklidir.' };
	}
	if (!partial || has('technologies')) {
		const tech = normalizeTechnologies(body.technologies ?? []);
		if (!tech) return { ok: false, error: 'Teknolojiler bir metin listesi olmalıdır.' };
		if (!tech.length) return { ok: false, error: 'En az bir teknoloji belirtin.' };
		value.technologies = tech;
	}
	if (!partial || has('teamId')) {
		const teamId = typeof body.teamId === 'string' && body.teamId ? body.teamId : null;
		if (teamId) {
			const team = await getTeamById(teamId);
			if (!team) return { ok: false, error: 'Takım bulunamadı.' };
			// A member can credit a team they belong to or lead, not any team.
			if (!can(user, 'projects', 'manage') && team.leadId !== user.id) {
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
			if (!can(user, 'projects', 'manage') && team.leadId !== user.id) {
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
			if (!owner || owner.status !== 'active') return { ok: false, error: 'Sahip üye bulunamadı.' };
			if (!can(user, 'projects', 'manage') && ownerUserId !== user.id) {
				return { ok: false, error: 'Bir üyeyi yalnızca kendiniz sahip olarak atayabilirsiniz.' };
			}
		}
		value.ownerUserId = ownerUserId;
	}
	return { ok: true, value };
}
