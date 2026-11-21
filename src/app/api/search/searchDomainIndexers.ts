import type { SearchField } from '@/lib/text';
import type { SearchHit } from '@/types/search';

export type AddSearchHit = (hit: Omit<SearchHit, 'score'>, fields: SearchField[]) => void;

const formatTL = (minor: number) =>
	`₺${(minor / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (ms: number) => new Date(Number(ms)).toLocaleDateString('tr-TR');

export function indexCatalogHits(
	add: AddSearchHit,
	params: {
		userId: string;
		managesEvents: boolean;
		managesCertificates: boolean;
		events: Array<{ id: string; status: string; title: string; start: number | string; location: string; description: string }>;
		news: Array<{ id: string; title: string; summary: string; content: string }>;
		items: Array<{ id: string; name: string; code: string; category: string; location: string }>;
		certificates: Array<{ id: string; userId: string; title: string; verificationCode: string; userName?: string }>;
	}
): void {
	const { userId, managesEvents, managesCertificates, events, news, items, certificates } = params;

	for (const e of events) {
		if (!managesEvents && e.status === 'draft') continue;
		add(
			{
				id: `event:${e.id}`,
				kind: 'event',
				appId: 'events',
				title: e.title,
				subtitle: [formatDate(Number(e.start)), e.location].filter(Boolean).join(' · '),
				target: { kind: 'event', itemId: e.id },
			},
			[
				{ text: e.title, weight: 4 },
				{ text: e.location, weight: 1 },
				{ text: e.description, weight: 1 },
			]
		);
	}

	for (const n of news) {
		add(
			{
				id: `news:${n.id}`,
				kind: 'news',
				appId: 'news',
				title: n.title,
				subtitle: n.summary,
				target: { kind: 'news', itemId: n.id },
			},
			[
				{ text: n.title, weight: 4 },
				{ text: n.summary, weight: 2 },
				{ text: n.content, weight: 1 },
			]
		);
	}

	for (const item of items) {
		add(
			{
				id: `item:${item.id}`,
				kind: 'item',
				appId: 'inventory',
				title: item.name,
				subtitle: [item.code, item.location].filter(Boolean).join(' · '),
				target: { kind: 'item', itemId: item.id },
			},
			[
				{ text: item.name, weight: 4 },
				{ text: item.code, weight: 4 },
				{ text: item.category, weight: 1 },
				{ text: item.location, weight: 1 },
			]
		);
	}

	for (const c of certificates) {
		const mine = c.userId === userId;
		add(
			{
				id: `certificate:${c.id}`,
				kind: 'certificate',
				appId: 'certificates',
				title: c.title,
				subtitle: [c.verificationCode, !mine && c.userName].filter(Boolean).join(' · '),
				target: { kind: 'cert', itemId: c.id, section: mine ? 'certificates' : 'all' },
			},
			[
				{ text: c.title, weight: 4 },
				{ text: c.verificationCode, weight: 3 },
				...(managesCertificates ? [{ text: c.userName, weight: 2 }] : []),
			]
		);
	}
}

export function indexVaultAndMailHits(
	add: AddSearchHit,
	params: {
		q: string;
		vaultApp: boolean;
		vaultEntries: Array<{
			vault: { teamId: string | null; name: string };
			records: Array<{ id: string; description: string; amountMinor: number; category: string }>;
		}>;
		threads: Array<{ id: string; topic: string; people: string; last: number | string; text: string }>;
		people: Array<{ id: string; name: string; surname: string }>;
	}
): void {
	const { q, vaultApp, vaultEntries, threads, people } = params;

	for (const { vault, records } of vaultEntries) {
		for (const r of records) {
			add(
				{
					id: `ledger:${r.id}`,
					kind: 'ledger',
					appId: vaultApp ? 'budget' : 'teams',
					title: r.description,
					subtitle: [formatTL(r.amountMinor), r.category, vault.name].join(' · '),
					target: vaultApp
						? { kind: 'ledger', itemId: r.id, parentId: vault.teamId ?? 'general' }
						: { section: 'vault', kind: 'ledger', itemId: r.id, parentId: vault.teamId ?? undefined },
				},
				[
					{ text: r.description, weight: 4 },
					{ text: r.category, weight: 2 },
					{ text: (r.amountMinor / 100).toFixed(2), weight: 1 },
				]
			);
		}
	}

	for (const th of threads) {
		add(
			{
				id: `message:${th.id}`,
				kind: 'message',
				appId: 'mail',
				title: th.topic,
				subtitle: [th.people, formatDate(Number(th.last))].filter(Boolean).join(' · '),
				target: { kind: 'thread', itemId: th.id },
			},
			[
				{ text: th.topic, weight: 4 },
				{ text: th.people, weight: 2 },
				{ text: th.text, weight: 1 },
			]
		);
	}

	for (const p of people) {
		add(
			{
				id: `compose:${p.id}`,
				kind: 'message',
				appId: 'mail',
				title: `${p.name} ${p.surname}`,
				target: { section: 'compose', itemId: p.id },
			},
			[{ text: `${p.name} ${p.surname}`, weight: 2 }, { text: q, weight: 1 }]
		);
	}
}
