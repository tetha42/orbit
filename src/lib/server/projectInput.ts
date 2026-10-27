import type { ProjectInput } from '@/db';
import { getUserTeamIds, getTeamById } from '@/db';
import { can, type YetkiliKullanici } from '@/lib/auth/access';
import {
	PROJE_ACIKLAMA_MAX,
	PROJE_BASLIK_MAX,
	PROJE_OZET_MAX,
	normalizeHttpUrl,
	normalizeTeknolojiler,
} from '@/lib/projects';

/**
 * Validates the editable fields of a project. With `partial`, absent fields are
 * left out of the result; otherwise title, summary and at least one link are
 * required. Returns the clean fields or the first problem, in Turkish.
 */
export async function parseProjeInput(
	body: Record<string, unknown>,
	user: YetkiliKullanici,
	partial: boolean
): Promise<{ ok: true; value: Partial<ProjectInput>; error?: undefined } | { ok: false; value?: undefined; error: string }> {
	const value: Partial<ProjectInput> = {};
	const has = (k: string) => body[k] !== undefined;

	if (!partial || has('baslik')) {
		const baslik = typeof body.baslik === 'string' ? body.baslik.trim() : '';
		if (baslik.length < 3) return { ok: false, error: 'Project başlığı en az 3 karakter olmalıdır.' };
		if (baslik.length > PROJE_BASLIK_MAX) return { ok: false, error: `Başlık en fazla ${PROJE_BASLIK_MAX} karakter olabilir.` };
		value.baslik = baslik;
	}
	if (!partial || has('ozet')) {
		const ozet = typeof body.ozet === 'string' ? body.ozet.trim() : '';
		if (ozet.length < 10) return { ok: false, error: 'Kısa açıklama en az 10 karakter olmalıdır.' };
		if (ozet.length > PROJE_OZET_MAX) return { ok: false, error: `Kısa açıklama en fazla ${PROJE_OZET_MAX} karakter olabilir.` };
		value.ozet = ozet;
	}
	if (!partial || has('aciklama')) {
		const aciklama = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
		if (aciklama.length > PROJE_ACIKLAMA_MAX) return { ok: false, error: `Ayrıntılı açıklama en fazla ${PROJE_ACIKLAMA_MAX} karakter olabilir.` };
		value.aciklama = aciklama;
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
	return { ok: true, value };
}
