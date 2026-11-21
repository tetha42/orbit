import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonSuccess } from '@/server/apiResponse';
import {
	InsufficientFundsError,
	createBudgetRecord,
	getBudgetRecords,
	getBudgetRecordById,
	getTeamById,
	updateBudgetRecord,
	getPgPool,
} from '@/db';
import { publishEventQuiet } from '@/db/events';
import { verifyVaultAccess } from '@/lib/vaultAccess';
import { withAudit } from '@/lib/audit/withAudit';
import budgetContract from '@/apps/budget/budget.contract.json';
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
	BudgetCreateBodySchema,
	BudgetDeleteQuerySchema,
	BudgetGetQuerySchema,
	BudgetGetResponseSchema,
	BudgetPatchBodySchema,
	BudgetTransferBodySchema,
	resolveBudgetVault,
} from '@/contracts/schemas/budget';
import { bad, deleteBudgetHandler, formatCurrency, parseVault, transferBudget } from './helpers';

const BudgetEnvelopeSchema = z.looseObject({});
const BudgetPostBodySchema = z.union([BudgetTransferBodySchema, BudgetCreateBodySchema]);

const budgetGetMeta = defineRouteMeta({
	id: 'budget.get',
	method: 'GET',
	path: '/api/budget',
	summary: 'List vault budget records and balance summary.',
	query: BudgetGetQuerySchema,
	response: BudgetGetResponseSchema,
	auth: 'vault',
});
const budgetPostMeta = defineRouteMeta({
	id: 'budget.create',
	method: 'POST',
	path: '/api/budget',
	summary: 'Create a vault transaction or transfer funds between vaults.',
	body: BudgetPostBodySchema,
	auth: 'vault',
});
const budgetPatchMeta = defineRouteMeta({
	id: 'budget.update',
	method: 'PATCH',
	path: '/api/budget',
	summary: 'Update description, category, date, or receipt of an entry.',
	body: BudgetPatchBodySchema,
	auth: 'vault',
});
const budgetDeleteMeta = defineRouteMeta({
	id: 'budget.delete',
	method: 'DELETE',
	path: '/api/budget',
	summary: 'Delete a budget record or revert an allowance transfer.',
	query: BudgetDeleteQuerySchema,
	auth: 'vault',
});

export const GET = defineRoute(budgetGetMeta, async function GET(request: Request) {
	const query = parseRouteQuery(new URL(request.url).searchParams, BudgetGetQuerySchema);
	if (!query.ok) return query.response;
	const teamId = resolveBudgetVault(query.data.teamId);

	// Vault readers and managers see every vault; a captain sees their project's vault.
	const access = await verifyVaultAccess(request, teamId, 'read');
	if (!access.authorized) return access.response;

	try {
		let name = 'General Vault';
		if (teamId) {
			const team = await getTeamById(teamId);
			if (!team) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
			name = team.name;
		}

		const records = await getBudgetRecords(teamId);
		let totalIncomeMinor = 0;
		let totalExpenseMinor = 0;
		for (const r of records) {
			if (r.type === 'income') totalIncomeMinor += r.amountMinor;
			else totalExpenseMinor += r.amountMinor;
		}

		return NextResponse.json({
			vault: { teamId, name, kind: teamId ? 'project' : 'general' },
			permission: { write: access.access === 'write' && access.user.status !== 'alumni', manage: access.isManagement },
			records,
			// Amounts travel as integer minor units only; each client formats them for its language.
			summary: {
				totalIncomeMinor,
				totalExpenseMinor,
				netBalanceMinor: totalIncomeMinor - totalExpenseMinor,
				recordCount: records.length,
			},
		});
	} catch (error) {
		console.error('API /api/budget GET error:', error);
		return NextResponse.json({ error: 'Operation could not be completed.' }, { status: 500 });
	}
});

export const POST = withAudit(
	defineRoute(budgetPostMeta, async function POST(request: Request) {
		try {
			const envelope = await parseRouteBody(request, BudgetEnvelopeSchema);
			if (!envelope.ok) return envelope.response;
			const body = envelope.data;

			if (body.action === 'transfer') {
				const access = await verifyVaultAccess(request, null, 'write');
				if (!access.authorized) return access.response;
				if (!access.isManagement) return bad('Transfers between vaults require vault management permission.', 403);
				const transfer = parseRouteData(body, BudgetTransferBodySchema);
				if (!transfer.ok) return transfer.response;
				return await transferBudget(request, transfer.data);
			}

			const teamId = parseVault(body.teamId);
			const access = await verifyVaultAccess(request, teamId, 'write');
			if (!access.authorized) return access.response;

			const parsed = parseRouteData(body, BudgetCreateBodySchema);
			if (!parsed.ok) return parsed.response;

			if (parsed.data.teamId && !(await getTeamById(parsed.data.teamId))) {
				return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
			}

			try {
				const result = await createBudgetRecord({ ...parsed.data, recorderId: access.user.id });
				await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
				return jsonSuccess(result);
			} catch (error) {
				// Guard against negative vault balance per vault.
				if (error instanceof InsufficientFundsError) {
					return NextResponse.json(
						{
							error: `Insufficient funds! Vault balance (${formatCurrency(error.netBalanceMinor)}) would be exceeded.`,
							code: 'INSUFFICIENT_FUNDS',
							netBalanceMinor: error.netBalanceMinor,
						},
						{ status: 409 }
					);
				}
				throw error;
			}
		} catch (error) {
			console.error('API /api/budget POST error:', error);
			return NextResponse.json({ error: 'Operation could not be completed.' }, { status: 500 });
		}
	}),
	{ action: 'budget.create', target: 'budget' }
);
withRouteMeta(POST, budgetPostMeta);

/** Corrects the description, category, date or receipt of an entry; never its type or amount. */
export const PATCH = withAudit(
	defineRoute(budgetPatchMeta, async function PATCH(request: Request) {
		try {
			const envelope = await parseRouteBody(request, BudgetEnvelopeSchema);
			if (!envelope.ok) return envelope.response;
			const body = envelope.data;
			const id = typeof body.id === 'string' ? body.id : '';

			// As with DELETE, the vault comes from the stored row, not from the request.
			const registration = id ? await getBudgetRecordById(id) : null;
			const access = await verifyVaultAccess(request, registration?.teamId ?? null, 'write');
			if (!access.authorized) return access.response;
			if (!registration) return contractErrorResponse(budgetContract, 'BUDGET_NOT_FOUND', 'Record not found.');
			// An allocation also touches the general vault, which only vault managers may change.
			if (registration.transferId && !access.isManagement) return bad('Only vault managers can modify allowance transfers.', 403);

			const parsed = parseRouteData(body, BudgetPatchBodySchema);
			if (!parsed.ok) return parsed.response;

			const { description, category, date, receiptUrl } = parsed.data;
			const changes = {
				...(description !== undefined ? { description } : {}),
				...(category !== undefined ? { category } : {}),
				...(date !== undefined ? { date } : {}),
				...(receiptUrl !== undefined ? { receiptUrl } : {}),
			};
			const r = await updateBudgetRecord(parsed.data.id, changes, access.user.id);
			if (r === 'none') return contractErrorResponse(budgetContract, 'BUDGET_NOT_FOUND', 'Record not found.');
			if (r === 'transfer') return bad('Transfer category and receipt cannot be changed.', 409);
			await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
			return jsonSuccess({ success: true });
		} catch (error) {
			console.error('API /api/budget PATCH error:', error);
			return bad('Operation could not be completed.', 500);
		}
	}),
	{ action: 'budget.update', target: 'budget' }
);
withRouteMeta(PATCH, budgetPatchMeta);

export const DELETE = withAudit(
	defineRoute(budgetDeleteMeta, async function DELETE(request: Request) {
		try {
			const query = parseRouteQuery(new URL(request.url).searchParams, BudgetDeleteQuerySchema);
			if (!query.ok) return query.response;
			return await deleteBudgetHandler(request);
		} catch (error) {
			console.error('API /api/budget DELETE error:', error);
			return NextResponse.json({ error: 'Operation could not be completed.' }, { status: 500 });
		}
	}),
	{
		action: 'budget.delete',
		target: 'budget',
		getTargetId: (req) => new URL(req.url).searchParams.get('id'),
	}
);
withRouteMeta(DELETE, budgetDeleteMeta);
