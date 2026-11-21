import {
	getBudgetRecords,
	getEvents,
	getNews,
	getUserTeamIds,
	getCertificates,
	getTeamTasks,
	getTeams,
	getMemberRoster,
} from '@/db';
import { getInventoryItems } from '@/db/repositories/inventory.repo';
import { searchMailCandidates, getMailSearchThreads } from '@/db/messages';
import { recipientList } from '@/server/messages';
import { can } from '@/lib/auth/access';
import { listAccessibleVaults } from '@/lib/vaultAccess';
import { scoreMatch, type SearchField } from '@/lib/text';
import type { AuthorizedUser } from '@/lib/auth/access';
import { MAX_HITS_PER_KIND, type SearchHit, type SearchKind } from '@/types/search';
import { searchChatMessages } from '@/domains/chatSearch/service';
import { indexCatalogHits, indexVaultAndMailHits } from './searchDomainIndexers';

export async function collectSearchHits(user: AuthorizedUser, q: string): Promise<Map<SearchKind, SearchHit[]>> {
	const uses = (app: string) => can(user, app, 'use');
	const manages = (app: string) => can(user, app, 'manage');
	const isAdmin = Boolean(user.permission?.admin || user.roleId === 'admin' || user.roleId === 'role_admin');
	const when = <T,>(ok: boolean, load: () => Promise<T[]>): Promise<T[]> => (ok ? load() : Promise.resolve([]));

	const [roster, teams, events, news, items, certificates, memberTeamIds, vaults, threads, people, chatHits] =
		await Promise.all([
			when(uses('members'), () => getMemberRoster()),
			when(uses('teams'), () => getTeams()),
			when(uses('events'), () => getEvents()),
			when(uses('news'), () => getNews(manages('news') ? 'management' : 'member')),
			when(uses('inventory'), () => getInventoryItems()),
			when(uses('certificates'), () => getCertificates(manages('certificates') ? undefined : user.id)),
			when(uses('teams') && !manages('teams'), () => getUserTeamIds(user.id)),
			listAccessibleVaults(user),
			when(uses('mail'), () => getMailSearchThreads(user.id)),
			when(uses('mail'), async () =>
				(await recipientList(await searchMailCandidates(user.id, q, MAX_HITS_PER_KIND))).filter((p) => p.reachable)
			),
			when(uses('chat'), async () => {
				const res = await searchChatMessages({ userId: user.id, isAdmin, q, limit: MAX_HITS_PER_KIND + 1 });
				return res.hits;
			}),
		]);

	const byKind = new Map<SearchKind, SearchHit[]>();
	const add = (hit: Omit<SearchHit, 'score'>, fields: SearchField[]) => {
		const score = scoreMatch(q, fields);
		if (score === 0) return;
		const list = byKind.get(hit.kind) ?? [];
		list.push({ ...hit, score });
		byKind.set(hit.kind, list);
	};

	const memberManager = manages('members');
	for (const m of roster) {
		if (!memberManager && m.status !== 'active') continue;
		add(
			{
				id: `member:${m.id}`,
				kind: 'member',
				appId: 'members',
				title: `${m.name} ${m.surname}`,
				subtitle: [m.department, m.teamName].filter(Boolean).join(' · '),
				target: { kind: 'member', itemId: m.id },
			},
			[
				{ text: `${m.name} ${m.surname}`, weight: 4 },
				{ text: m.department, weight: 1 },
				{ text: m.teamName, weight: 1 },
				...(memberManager
					? [
							{ text: m.email, weight: 2 },
							{ text: m.studentNo, weight: 2 },
						]
					: []),
			]
		);
	}

	const canSeeTasksOf = (teamId: string, leadId: string) =>
		manages('teams') || leadId === user.id || memberTeamIds.includes(teamId);

	for (const team of teams) {
		add(
			{
				id: `team:${team.id}`,
				kind: 'team',
				appId: 'teams',
				title: team.name,
				subtitle: [team.category, team.leaderName && `Captain: ${team.leaderName}`].filter(Boolean).join(' · '),
				target: { kind: 'team', itemId: team.id },
			},
			[
				{ text: team.name, weight: 4 },
				{ text: team.category, weight: 2 },
				{ text: team.description, weight: 1 },
			]
		);
	}

	const taskLists = await Promise.all(
		teams
			.filter((team) => canSeeTasksOf(team.id, team.leadId))
			.map(async (team) => ({ team, tasks: await getTeamTasks(team.id) }))
	);
	for (const { team, tasks } of taskLists) {
		for (const task of tasks) {
			add(
				{
					id: `task:${task.id}`,
					kind: 'task',
					appId: 'teams',
					title: task.title,
					subtitle: team.name,
					target: { kind: 'task', itemId: task.id, parentId: team.id },
				},
				[
					{ text: task.title, weight: 4 },
					{ text: task.description, weight: 1 },
					{ text: task.assigneeName, weight: 1 },
				]
			);
		}
	}

	indexCatalogHits(add, {
		userId: user.id,
		managesEvents: manages('events'),
		managesCertificates: manages('certificates'),
		events,
		news,
		items,
		certificates,
	});

	const vaultEntries = await Promise.all(
		vaults.map(async (vault) => ({ vault, records: await getBudgetRecords(vault.teamId) }))
	);
	indexVaultAndMailHits(add, { q, vaultApp: uses('budget'), vaultEntries, threads, people });

	for (const hit of chatHits) {
		const score = Math.max(
			1,
			scoreMatch(q, [
				{ text: hit.content, weight: 4 },
				{ text: hit.roomName, weight: 2 },
				{ text: hit.senderName, weight: 2 },
			])
		);
		const list = byKind.get('message') ?? [];
		list.push({
			id: `chat:${hit.id}`,
			kind: 'message',
			appId: 'chat',
			title: `${hit.senderName} · ${hit.roomName}`,
			subtitle: hit.snippet,
			target: { kind: 'thread', itemId: hit.roomId, parentId: hit.id },
			score,
		});
		byKind.set('message', list);
	}

	return byKind;
}
