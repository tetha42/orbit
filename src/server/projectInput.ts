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
 * required. Returns the clean fields or the first validation error.
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
		if (title.length < 3) return { ok: false, error: 'Project title must be at least 3 characters.' };
		if (title.length > PROJECT_TITLE_MAX) return { ok: false, error: `Project title can be at most ${PROJECT_TITLE_MAX} characters.` };
		value.title = title;
	}
	if (!partial || has('summary')) {
		const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
		if (summary.length < 10) return { ok: false, error: 'Summary must be at least 10 characters.' };
		if (summary.length > PROJECT_SUMMARY_MAX) return { ok: false, error: `Summary can be at most ${PROJECT_SUMMARY_MAX} characters.` };
		value.summary = summary;
	}
	if (!partial || has('description')) {
		const description = typeof body.description === 'string' ? body.description.trim() : '';
		if (description.length > PROJECT_DESCRIPTION_MAX) return { ok: false, error: `Detailed description can be at most ${PROJECT_DESCRIPTION_MAX} characters.` };
		value.description = description;
	}
	for (const key of ['repoUrl', 'liveUrl'] as const) {
		if (!partial || has(key)) {
			const url = normalizeHttpUrl(body[key]);
			if (url === undefined) {
				return { ok: false, error: key === 'repoUrl' ? 'Enter a valid repository URL (https://…).' : 'Enter a valid live demo URL (https://…).' };
			}
			value[key] = url;
		}
	}
	if (!partial && !value.repoUrl && !value.liveUrl) {
		return { ok: false, error: 'At least one repository or live demo link is required.' };
	}
	if (!partial || has('technologies')) {
		const tech = normalizeTechnologies(body.technologies ?? []);
		if (!tech) return { ok: false, error: 'Technologies must be a list of strings.' };
		if (!tech.length) return { ok: false, error: 'Specify at least one technology.' };
		value.technologies = tech;
	}
	if (!partial || has('teamId')) {
		const teamId = typeof body.teamId === 'string' && body.teamId ? body.teamId : null;
		if (teamId) {
			const team = await getTeamById(teamId);
			if (!team) return { ok: false, error: 'Team not found.' };
			// A member can credit a team they belong to or lead, not any team.
			if (!can(user, 'projects', 'manage') && team.leadId !== user.id) {
				const mine = await getUserTeamIds(user.id);
				if (!mine.includes(teamId)) return { ok: false, error: 'You can only link a project to a team you belong to.' };
			}
		}
		value.teamId = teamId;
	}
	if (!partial || has('ownerTeamId')) {
		const ownerTeamId = typeof body.ownerTeamId === 'string' && body.ownerTeamId ? body.ownerTeamId : null;
		if (ownerTeamId) {
			const team = await getTeamById(ownerTeamId);
			if (!team) return { ok: false, error: 'Owner team not found.' };
			if (!can(user, 'projects', 'manage') && team.leadId !== user.id) {
				const mine = await getUserTeamIds(user.id);
				if (!mine.includes(ownerTeamId)) return { ok: false, error: 'A project owner team must be a team you belong to.' };
			}
		}
		value.ownerTeamId = ownerTeamId;
	}
	if (!partial || has('ownerUserId')) {
		const ownerUserId = typeof body.ownerUserId === 'string' && body.ownerUserId ? body.ownerUserId : null;
		if (ownerUserId) {
			const owner = await getUserById(ownerUserId);
			if (!owner || owner.status !== 'active') return { ok: false, error: 'Owner member not found.' };
			if (!can(user, 'projects', 'manage') && ownerUserId !== user.id) {
				return { ok: false, error: 'You can only assign yourself as the member owner.' };
			}
		}
		value.ownerUserId = ownerUserId;
	}
	return { ok: true, value };
}
