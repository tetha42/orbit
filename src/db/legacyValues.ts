/**
 * One-time, idempotent upgrade of data written by the Turkish-vocabulary releases.
 *
 * Everything the application stores is English now: status and type values,
 * role ids, settings keys, and the keys inside JSON documents. A database that
 * still holds the old words is rewritten here at start-up. Every statement only
 * touches rows that still carry an old value, so a migrated database is left
 * alone. The same word lists drive scripts/check-identifiers.mjs.
 */
import type { PoolClient } from 'pg';
import legacyWords from './legacy/words.json';
import legacyValues from './legacy/values.json';

const WORDS = legacyWords.words as Record<string, string>;
const VALUES = legacyValues.values as Record<string, string>;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const PIECE = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+|_+|\$+|[^A-Za-z0-9_$]+/g;
const MI_KEYS: Record<string, string> = {
	doneMi: 'isDone', publicOpenMi: 'isPublicOpen', importantMi: 'isImportant', iLikedMi: 'likedByMe', deliveredMi: 'isDelivered',
	lockedMi: 'isLocked', trashedMi: 'isTrashed', pinnedMi: 'isPinned', kamuyaAcikMi: 'isPublicOpen', kilitliMi: 'isLocked',
};

/** The English name of a stored JSON key (`olusturma` → `creation`, `yapanAd` → `actorName`). */
export function englishKey(key: string): string {
	if (has(MI_KEYS, key)) return MI_KEYS[key];
	const pieces = key.match(PIECE) ?? [key];
	let changed = false;
	const out = pieces.map((piece, i) => {
		const english = /^[A-Za-z]+$/.test(piece) && has(WORDS, piece.toLowerCase()) ? WORDS[piece.toLowerCase()] : undefined;
		if (english === undefined) return piece;
		changed = true;
		return i > 0 || /^[A-Z]/.test(piece) ? english[0].toUpperCase() + english.slice(1) : english;
	});
	return changed ? out.join('') : key;
}

/** Keys whose string value is one of the stored vocabulary words. */
const VALUE_KEYS = new Set(['type', 'from', 'to', 'status', 'kind', 'category']);

function convertJson(node: unknown, key?: string): unknown {
	if (Array.isArray(node)) return node.map((item) => convertJson(item, key));
	if (node && typeof node === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[englishKey(k)] = convertJson(v, englishKey(k));
		return out;
	}
	if (typeof node === 'string' && key && VALUE_KEYS.has(key) && has(VALUES, node)) return VALUES[node];
	return node;
}

type ValueMap = Record<string, string>;
const m = (pairs: Record<string, string>): ValueMap => pairs;

const USER_STATUS = m({ aktif: 'active', beklemede: 'pending', reddedildi: 'rejected', mezun: 'alumni', askida: 'suspended' });
const ROOM_TYPE = m({ genel: 'general', takim: 'team', ozel: 'private' });
const MAIL_FOLDER = m({ gelen: 'inbox', gonderilen: 'sent', arsiv: 'archived', cop: 'trash', silindi: 'deleted' });
const TASK_STATUS = m({ yapilacak: 'todo', suruyor: 'in_progress', inceleme: 'review', tamamlandi: 'done', bitti: 'done' });
const PRIORITY = m({ dusuk: 'low', orta: 'medium', yuksek: 'high', kritik: 'critical' });
const ITEM_STATUS = m({ saglam: 'available', oduncte: 'on_loan', arizali: 'faulty', kayip: 'lost', onarimda: 'repairing' });
const EVENT_CATEGORY = m({ atolye: 'workshop', seminer: 'seminar', yarisma: 'competition', toplanti: 'meeting' });
const NEWS_CATEGORY = m({ genel: 'general', atolye: 'workshop', isbirligi: 'collaboration', resmi: 'official' });
const PUBLISH = m({ yayinda: 'published', taslak: 'draft', iptal: 'cancelled', tamamlandi: 'done' });
const PROJECT_STATUS = m({ oneri: 'proposed', yayinda: 'published', arsiv: 'archived' });
const BUDGET_CATEGORY = m({
	'İkram': 'catering', 'Afiş/Baskı': 'printing', Sponsorluk: 'sponsorship', 'Donanım': 'hardware',
	'Ulaşım': 'transport', 'Diğer': 'other', 'Ödenek Aktarımı': 'allowance_transfer',
});

/** table, column, old value → new value. */
const COLUMN_VALUES: Array<[string, string, ValueMap]> = [
	['users', 'status', USER_STATUS],
	['team_members', 'status', m({ aktif: 'active', basvurdu: 'applied', beklemede: 'pending', reddedildi: 'rejected' })],
	['team_members', 'decision', m({ kabul: 'accepted', reddet: 'rejected', reddedildi: 'rejected' })],
	['teams', 'status', m({ aktif: 'active', askida: 'suspended', arsiv: 'archived' })],
	['teams', 'join_policy', m({ acik: 'open', onayli: 'approval' })],
	['team_tasks', 'status', TASK_STATUS],
	['team_tasks', 'priority', PRIORITY],
	['inventory', 'status', ITEM_STATUS],
	['events', 'status', PUBLISH],
	['events', 'category', EVENT_CATEGORY],
	['event_participants', 'status', m({ kayitli: 'registered' })],
	['event_participants', 'checkin_method', m({ bilet: 'ticket', manuel: 'manual' })],
	['news', 'category', NEWS_CATEGORY],
	['news', 'publish_status', PUBLISH],
	['projects', 'status', PROJECT_STATUS],
	['budget_records', 'entry_type', m({ gelir: 'income', gider: 'expense' })],
	['budget_records', 'category', BUDGET_CATEGORY],
	['chat_rooms', 'room_type', ROOM_TYPE],
	['chat_members', 'folder', MAIL_FOLDER],
	['chat_messages', 'sender_id', m({ sistem: 'system' })],
	['decisions', 'record_type', m({ karar: 'resolution', salon_tahsisi: 'hall_allocation', etkinlik_izni: 'event_permission', malzeme_talep: 'material_request', ust_yazi: 'cover_letter' })],
	['decisions', 'decision_type', m({ karar: 'resolution' })],
	['decisions', 'status', PUBLISH],
	['verification_tokens', 'token_type', m({ sifre_sifirlama: 'password_reset' })],
	['user_notes', 'color', m({ sari: 'yellow' })],
];

const ROLE_IDS = m({ rol_admin: 'role_admin', rol_uye: 'role_member', rol_mezun: 'role_alumni', rol_yonetim_kurulu: 'role_management_board' });
const SETTING_KEYS = m({
	kulup_adi: 'club_name', kulup_domain: 'club_domain',
	imza1_ad: 'signature1_name', imza1_unvan: 'signature1_rank', imza2_ad: 'signature2_name', imza2_unvan: 'signature2_rank',
});
const PERMISSION_LEVELS = m({ yok: 'none', kullan: 'use', yonet: 'manage' });

/** JSON documents: table, column, whether the column is JSONB (otherwise TEXT holding JSON). */
const JSON_COLUMNS: Array<[string, string, boolean]> = [
	['team_tasks', 'checklist', true],
	['team_tasks', 'comments', true],
	['team_tasks', 'activities', true],
	['inventory', 'activities', true],
	['chat_messages', 'attachments', false],
	['chat_polls', 'options', true],
];

async function columnExists(client: PoolClient, table: string, column: string): Promise<boolean> {
	const res = await client.query(
		`SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
		[table, column]
	);
	return (res.rowCount ?? 0) > 0;
}

async function remapColumn(client: PoolClient, table: string, column: string, map: ValueMap): Promise<void> {
	if (!(await columnExists(client, table, column))) return;
	const olds = Object.keys(map);
	await client.query(
		`UPDATE ${table} SET ${column} = ($2::jsonb ->> ${column}) WHERE ${column} = ANY($1::text[])`,
		[olds, JSON.stringify(map)]
	);
}

async function renameRoleIds(client: PoolClient): Promise<void> {
	for (const [oldId, newId] of Object.entries(ROLE_IDS)) {
		await client.query(`UPDATE users SET role_id = $2 WHERE role_id = $1`, [oldId, newId]);
		await client.query(`UPDATE system_settings SET value = $2 WHERE value = $1 AND key LIKE '%role%'`, [oldId, newId]);
		await client.query(
			`UPDATE roles SET id = $2 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM roles WHERE id = $2)`,
			[oldId, newId]
		);
		await client.query(`DELETE FROM roles WHERE id = $1`, [oldId]);
	}
}

async function renameGeneralRoom(client: PoolClient): Promise<void> {
	const oldId = 'oda_genel';
	const newId = 'room_general';
	const old = await client.query(`SELECT 1 FROM chat_rooms WHERE id = $1`, [oldId]);
	if (!old.rowCount) return;
	await client.query(
		`INSERT INTO chat_rooms (id, room_type, team_id, name, created_by, created_at)
		 SELECT $2, room_type, team_id, name, created_by, created_at FROM chat_rooms WHERE id = $1
		 ON CONFLICT (id) DO NOTHING`,
		[oldId, newId]
	);
	for (const table of ['chat_members', 'chat_messages', 'chat_polls']) {
		if (table === 'chat_members') {
			await client.query(
				`UPDATE chat_members SET room_id = $2 WHERE room_id = $1
				 AND NOT EXISTS (SELECT 1 FROM chat_members x WHERE x.room_id = $2 AND x.user_id = chat_members.user_id)`,
				[oldId, newId]
			);
		} else {
			await client.query(`UPDATE ${table} SET room_id = $2 WHERE room_id = $1`, [oldId, newId]);
		}
	}
	await client.query(`DELETE FROM chat_rooms WHERE id = $1`, [oldId]);
}

async function renameSettingKeys(client: PoolClient): Promise<void> {
	for (const [oldKey, newKey] of Object.entries(SETTING_KEYS)) {
		await client.query(
			`UPDATE system_settings SET key = $2 WHERE key = $1 AND NOT EXISTS (SELECT 1 FROM system_settings WHERE key = $2)`,
			[oldKey, newKey]
		);
		await client.query(`DELETE FROM system_settings WHERE key = $1`, [oldKey]);
	}
}

async function renamePermissionLevels(client: PoolClient): Promise<void> {
	const rows = await client.query(`SELECT id, permissions FROM roles WHERE permissions::text ~ '"(yok|kullan|yonet)"'`);
	for (const row of rows.rows) {
		const perms = row.permissions as Record<string, string>;
		const next = Object.fromEntries(Object.entries(perms).map(([app, level]) => [app, has(PERMISSION_LEVELS, level) ? PERMISSION_LEVELS[level] : level]));
		await client.query(`UPDATE roles SET permissions = $2::jsonb WHERE id = $1`, [row.id, JSON.stringify(next)]);
	}
}

async function convertJsonColumn(client: PoolClient, table: string, column: string, jsonb: boolean): Promise<void> {
	if (!(await columnExists(client, table, column))) return;
	const cast = jsonb ? '' : '::text';
	const rows = await client.query(`SELECT id, ${column}${cast} AS doc FROM ${table} WHERE ${column}${cast} ~ '"[a-z]+(Mi)?"\\s*:' `);
	for (const row of rows.rows) {
		let parsed: unknown;
		try {
			parsed = typeof row.doc === 'string' ? JSON.parse(row.doc) : row.doc;
		} catch {
			continue;
		}
		const next = JSON.stringify(convertJson(parsed));
		const before = JSON.stringify(parsed);
		if (next === before) continue;
		await client.query(`UPDATE ${table} SET ${column} = $2${jsonb ? '::jsonb' : ''} WHERE id = $1`, [row.id, next]);
	}
}

export async function migrateLegacyValues(client: PoolClient): Promise<void> {
	await renameRoleIds(client);
	await renameSettingKeys(client);
	await renamePermissionLevels(client);
	for (const [table, column, map] of COLUMN_VALUES) await remapColumn(client, table, column, map);
	await renameGeneralRoom(client);
	for (const [table, column, jsonb] of JSON_COLUMNS) await convertJsonColumn(client, table, column, jsonb);
	// Chat poll attachments were tagged `{ tip: 'anket' }`.
	await client.query(`UPDATE chat_messages SET attachments = replace(replace(attachments, '"tip":"anket"', '"type":"poll"'), '"tip":', '"type":') WHERE attachments LIKE '%"tip"%'`);
}
