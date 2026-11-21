import { ensurePostgresInit, getPgPool } from '@/db/index';
import type { InventoryItem } from '@/db/schema';
import { INVENTORY_SELECT_COLUMNS, type InventoryActivity } from './shared';

/** Single inventory row, used to validate a borrow/return before writing. */
export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`SELECT ${INVENTORY_SELECT_COLUMNS} FROM inventory WHERE id = $1`, [id]);
	return (res.rows[0] as InventoryItem) ?? null;
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`
		SELECT e.id, e.code AS code, e.name AS name, e.category AS category, e.status, e.location AS location,
		       e.holder_user_id AS "holderUserId",
		       e.due_at AS "dueDate",
		       e.borrowed_at AS "loanDate", e.description AS description, e.serial_number AS "serialNo",
		       k.first_name || ' ' || k.last_name AS "holderName"
		FROM inventory e
		LEFT JOIN users k ON e.holder_user_id = k.id
		ORDER BY e.code ASC
	`);
	return res.rows as InventoryItem[];
}

/** An item's history, newest first. */
export async function getInventoryActivities(inventoryId: string, limit = 50): Promise<InventoryActivity[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        COALESCE(elem->>'type', elem->>'typeValue') AS type,
		        COALESCE(elem->>'typeValue', elem->>'type') AS "typeValue",
		        elem->>'description' AS description,
		        (elem->>'date')::bigint AS date,
		        a.first_name || ' ' || a.last_name AS "actorName",
		        u.first_name || ' ' || u.last_name AS "userName"
		 FROM inventory i,
		      jsonb_array_elements(COALESCE(i.activities, '[]'::jsonb)) AS elem
		 LEFT JOIN users a ON a.id = elem->>'actorId'
		 LEFT JOIN users u ON u.id = elem->>'userId'
		 WHERE i.id = $1
		 ORDER BY (elem->>'date')::bigint DESC, elem->>'id' DESC
		 LIMIT $2`,
		[inventoryId, limit]
	);
	return res.rows.map((r) => ({ ...r, date: Number(r.date) }));
}
