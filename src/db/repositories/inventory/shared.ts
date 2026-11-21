import { randomBytes } from 'crypto';
import type { PoolClient } from 'pg';

export class InventoryCodeExistsError extends Error {
	constructor(message = 'This inventory code is already in use.') {
		super(message);
		this.name = 'InventoryCodeExistsError';
	}
}

export type InventoryActivityType = 'add' | 'loan' | 'return' | 'extend' | 'status' | 'edit';

export interface InventoryActivity {
	id: string;
	type: InventoryActivityType;
	typeValue?: InventoryActivityType;
	description: string | null;
	date: number;
	actorName: string | null;
	userName: string | null;
}

export const INVENTORY_SELECT_COLUMNS = `
	id, code AS code, name AS name, category AS category, status, location AS location,
	holder_user_id AS "holderUserId",
	due_at AS "dueDate",
	borrowed_at AS "loanDate", description AS description, serial_number AS "serialNo"
`;

export async function addMovement(
	client: PoolClient,
	h: { inventoryId: string; typeValue: InventoryActivityType; actorId: string; userId?: string | null; description?: string | null }
): Promise<void> {
	const entry = {
		id: `im_${Date.now()}_${randomBytes(4).toString('hex')}`,
		type: h.typeValue,
		typeValue: h.typeValue,
		actorId: h.actorId,
		userId: h.userId ?? null,
		description: h.description ?? null,
		date: Date.now(),
	};
	await client.query(
		`UPDATE inventory SET activities = COALESCE(activities, '[]'::jsonb) || $2::jsonb WHERE id = $1`,
		[h.inventoryId, JSON.stringify([entry])]
	);
}
