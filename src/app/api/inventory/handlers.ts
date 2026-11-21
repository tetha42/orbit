import { NextResponse } from 'next/server';
import { getUserById, getPgPool } from '@/db';
import { publishEventQuiet } from '@/db/events';
import {
	InventoryCodeExistsError,
	createInventoryItem,
	deleteInventoryItem,
	getInventoryItemById,
	markReturned,
	extendLoan,
	lendInventoryItem,
	setInventoryStatus,
	updateInventoryItem,
} from '@/db/repositories/inventory.repo';
import { DEFAULT_LOAN_DAYS, returnDateProblem, codeProblem, normalizeCode } from '@/lib/inventory';
import { INVENTORY_STATUSES, isInventoryStatus } from '@/types/inventory';
import inventoryContract from '@/apps/inventory/inventory.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

const DAY = 86_400_000;
export const badInventory = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** A trimmed string field within limits; `undefined` when absent, `null` when it fails. */
function text(value: unknown, min: number, max: number): string | undefined | null {
	if (value === undefined) return undefined;
	const s = typeof value === 'string' ? value.trim() : '';
	return s.length >= min && s.length <= max ? s : null;
}

export async function handleInventoryCreateOrUpdate(
	action: 'create' | 'update',
	body: Record<string, unknown>,
	inventoryId: string,
	actorId: string
) {
	const fields: {
		code?: string;
		name?: string;
		category?: string;
		location?: string;
		description?: string | null;
		serialNo?: string | null;
	} = {};
	if (body.code !== undefined || action === 'create') {
		const code = normalizeCode(body.code);
		if (code.length > inventoryContract.limits.maxCodeLength) {
			return badInventory(`Code can be at most ${inventoryContract.limits.maxCodeLength} characters.`);
		}
		const err = codeProblem(code);
		if (err) return badInventory(err);
		fields.code = code;
	}
	for (const [key, min, max, label] of [
		['name', 3, Math.min(120, inventoryContract.limits.maxNameLength), 'Name'],
		['category', 2, 60, 'Category'],
		['location', 2, 120, 'Location'],
	] as const) {
		const v = text(body[key], min, max);
		if (v === null || (v === undefined && action === 'create')) {
			return badInventory(`${label} must be between ${min} and ${max} characters.`);
		}
		if (v !== undefined) fields[key] = v;
	}
	if (body.description !== undefined) {
		const v = typeof body.description === 'string' ? body.description.trim() : '';
		if (v.length > 1000) {
			return badInventory('Description can be at most 1000 characters.');
		}
		fields.description = v || null;
	}
	const rawSerial = body.serialNo !== undefined ? body.serialNo : body.seriesNo;
	if (rawSerial !== undefined) {
		const v = typeof rawSerial === 'string' ? rawSerial.trim() : '';
		if (v.length > 80) {
			return badInventory('Serial number can be at most 80 characters.');
		}
		fields.serialNo = v || null;
	}

	if (action === 'create') {
		try {
			const item = await createInventoryItem({
				code: fields.code!,
				name: fields.name!,
				category: fields.category!,
				location: fields.location!,
				description: fields.description,
				serialNo: fields.serialNo,
				status: isInventoryStatus(body.status) && body.status !== 'on_loan' ? body.status : 'available',
				actorId,
			});
			await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
			return NextResponse.json({ success: true, item }, { status: 201 });
		} catch (err) {
			if (err instanceof InventoryCodeExistsError) return badInventory(`${fields.code} code is already in use.`, 409);
			throw err;
		}
	}

	const r = await updateInventoryItem(inventoryId, fields, actorId);
	if (r === 'none') return contractErrorResponse(inventoryContract, 'ITEM_NOT_FOUND');
	if (r === 'code_exists') return badInventory(`${fields.code} code is already in use.`, 409);
	await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
	return NextResponse.json({ success: true });
}

export async function handleInventoryLoanOrStatus(params: {
	action: string;
	body: Record<string, unknown>;
	inventoryId: string;
	userId: string;
	isManager: boolean;
}) {
	const { action, body, inventoryId, userId: actorId, isManager } = params;
	const now = Date.now();

	if (action === 'delete') {
		if (!isManager) return badInventory('Only managers can delete hardware.', 403);
		const r = await deleteInventoryItem(inventoryId);
		if (r === 'none') return contractErrorResponse(inventoryContract, 'ITEM_NOT_FOUND', 'Item not found or could not be deleted.');
		if (r === 'on_loan') {
			return contractErrorResponse(
				inventoryContract,
				'ITEM_ALREADY_BORROWED',
				'Cannot delete an item that is on loan; please return it first.',
				undefined,
				409
			);
		}
		await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
		return NextResponse.json({ success: true, message: 'Inventory item deleted.' });
	}

	if (action === 'borrow') {
		let userId = actorId;
		if (isManager && typeof body.userId === 'string' && body.userId && body.userId !== actorId) {
			const target = await getUserById(body.userId);
			if (!target || target.status !== 'active') return badInventory('Target member not found or inactive.', 404);
			userId = target.id;
		}
		const dueDate =
			body.dueDate !== undefined
				? Number(body.dueDate)
				: body.returnDate === undefined
				? now + DEFAULT_LOAN_DAYS * DAY
				: Number(body.returnDate);
		const err = returnDateProblem(dueDate, { now, management: isManager });
		if (err) return badInventory(err);
		const r = await lendInventoryItem({ id: inventoryId, userId, dueDate, returnDate: dueDate, actorId });
		if (r === 'none') return contractErrorResponse(inventoryContract, 'ITEM_NOT_FOUND');
		if (r === 'unavailable') {
			return contractErrorResponse(
				inventoryContract,
				'ITEM_ALREADY_BORROWED',
				'Item is currently unavailable (on loan, broken, or lost).',
				undefined,
				409
			);
		}
		await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
		return NextResponse.json({ success: true, message: 'Loan recorded successfully.' });
	}

	if (action === 'return') {
		const note = text(body.note ?? body.not, 0, 500);
		if (note === null) return badInventory('Note can be at most 500 characters.');
		const r = await markReturned({
			id: inventoryId,
			actorId,
			borrowerOnly: isManager ? undefined : actorId,
			failure: body.failure === true,
			note: note ?? undefined,
			not: note ?? undefined,
		});
		if (r === 'none') return contractErrorResponse(inventoryContract, 'ITEM_NOT_FOUND');
		if (r === 'not_on_loan') return badInventory('This item is not on loan.', 409);
		if (r === 'permission') return badInventory('Only borrower or managers can return this item.', 403);
		await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
		return NextResponse.json({
			success: true,
			message: body.failure === true ? 'Item returned and marked as broken.' : 'Item returned successfully.',
		});
	}

	if (action === 'extend') {
		const item = await getInventoryItemById(inventoryId);
		if (!item) return contractErrorResponse(inventoryContract, 'ITEM_NOT_FOUND');
		if (item.status !== 'on_loan') return badInventory('This item is not on loan.', 409);
		if (!isManager && item.holderUserId !== actorId) return badInventory('Only borrower or managers can extend the loan.', 403);
		const dueDate = Number(body.dueDate ?? body.returnDate);
		const err = returnDateProblem(dueDate, { now, start: item.loanDate ?? now, management: isManager });
		if (err) return badInventory(err);
		const r = await extendLoan({
			id: inventoryId,
			dueDate,
			returnDate: dueDate,
			actorId,
			borrowerOnly: isManager ? undefined : actorId,
		});
		if (r !== 'ok') return badInventory('Loan could not be extended; item status may have changed.', 409);
		await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
		return NextResponse.json({ success: true, message: 'Due date updated.' });
	}

	if (action === 'updateStatus') {
		if (!isManager) return badInventory('Only managers can update inventory status.', 403);
		const status = body.status;
		if (!isInventoryStatus(status) || status === 'on_loan') {
			return badInventory(`Invalid status. Expected: ${INVENTORY_STATUSES.filter((d) => d !== 'on_loan').join(', ')}`);
		}
		const note = text(body.note ?? body.not, 0, 500);
		const r = await setInventoryStatus({ id: inventoryId, status, actorId, note: note ?? undefined, not: note ?? undefined });
		if (r === 'none') return contractErrorResponse(inventoryContract, 'ITEM_NOT_FOUND');
		if (r === 'on_loan') {
			return contractErrorResponse(inventoryContract, 'ITEM_ALREADY_BORROWED', 'Item is on loan; return it first.', undefined, 409);
		}
		await publishEventQuiet(getPgPool(), { k: 'inventory_updated' });
		return NextResponse.json({ success: true, message: 'Inventory status updated.', status });
	}

	return badInventory('Invalid action.');
}
