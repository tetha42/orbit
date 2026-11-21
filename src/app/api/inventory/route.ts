import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAudit } from '@/lib/audit/withAudit';
import { getInventoryItems, getInventoryItemById, getInventoryActivities } from '@/db/repositories/inventory.repo';
import { can, requireApp } from '@/lib/auth/access';
import inventoryContract from '@/apps/inventory/inventory.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import {
	defineRoute,
	defineRouteMeta,
	parseRouteBody,
	parseRouteData,
	parseRouteQuery,
	withRouteMeta,
} from '@/contracts/defineRoute';
import {
	InventoryListResponseSchema,
	InventoryPostBodySchema,
	InventoryQuerySchema,
} from '@/contracts/schemas/inventory';
import { badInventory, handleInventoryCreateOrUpdate, handleInventoryLoanOrStatus } from './handlers';

const InventoryEnvelopeSchema = z.looseObject({});
const MANAGER_ONLY_ACTIONS = new Set(['create', 'update', 'delete', 'updateStatus']);

const inventoryGetMeta = defineRouteMeta({
	id: 'inventory.get',
	method: 'GET',
	path: '/api/inventory',
	summary: 'List inventory items or query movement history for a single item.',
	query: InventoryQuerySchema,
	response: InventoryListResponseSchema,
	auth: 'app',
});

const inventoryPostMeta = defineRouteMeta({
	id: 'inventory.mutate',
	method: 'POST',
	path: '/api/inventory',
	summary: 'Create, update, delete, borrow, return, extend, or update status of inventory items.',
	body: InventoryPostBodySchema,
	auth: 'app',
});

export const GET = defineRoute(inventoryGetMeta, async function GET(request: Request) {
	// Inventory is visible to members, but the custody columns (who holds what)
	// must not be readable anonymously.
	const auth = await requireApp(request, 'inventory', 'use');
	if (!auth.authorized) return auth.response;

	const query = parseRouteQuery(new URL(request.url).searchParams, InventoryQuerySchema);
	if (!query.ok) return query.response;

	try {
		// `?history=<id>`: one item's history (who borrowed it, returns, repairs, edits).
		const history = query.data.history;
		if (history) {
			if (!(await getInventoryItemById(history))) {
				return contractErrorResponse(inventoryContract, 'ITEM_NOT_FOUND');
			}
			return NextResponse.json({ movements: await getInventoryActivities(history) });
		}
		const items = await getInventoryItems();
		return NextResponse.json(items);
	} catch (error) {
		console.error('API /api/inventory GET error:', error);
		return badInventory('Failed to load inventory.', 500);
	}
});

async function handlePOST(request: Request) {
	try {
		const auth = await requireApp(request, 'inventory', 'use');
		if (!auth.authorized) return auth.response;
		if (auth.user.status === 'alumni') {
			return badInventory('Alumni have read-only access.', 403);
		}

		const envelope = await parseRouteBody(request, InventoryEnvelopeSchema);
		if (!envelope.ok) return envelope.response;

		const rawAction = typeof envelope.data.action === 'string' ? envelope.data.action : '';
		const isManager = can(auth.user, 'inventory', 'manage');
		if (MANAGER_ONLY_ACTIONS.has(rawAction) && !isManager) {
			const msg =
				rawAction === 'delete'
					? 'Only managers can delete hardware.'
					: rawAction === 'updateStatus'
						? 'Only managers can update inventory status.'
						: 'Only managers can add or edit hardware.';
			return badInventory(msg, 403);
		}

		const parsed = parseRouteData(envelope.data, InventoryPostBodySchema);
		if (!parsed.ok) return parsed.response;

		const data = parsed.data;
		if (data.action === 'create' || data.action === 'update') {
			return await handleInventoryCreateOrUpdate(
				data.action,
				data,
				data.action === 'update' ? data.inventoryId : '',
				auth.user.id
			);
		}

		return await handleInventoryLoanOrStatus({
			action: data.action,
			body: data,
			inventoryId: data.inventoryId,
			userId: auth.user.id,
			isManager,
		});
	} catch (error) {
		console.error('API /api/inventory error:', error);
		return badInventory('Operation could not be completed.', 500);
	}
}

export const POST = withAudit(defineRoute(inventoryPostMeta, handlePOST), {
	action: 'inventory.create',
	target: 'inventory',
});
withRouteMeta(POST, inventoryPostMeta);
