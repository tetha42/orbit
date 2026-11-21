import { NextResponse } from 'next/server';
import { jsonError, jsonSuccess } from '@/server/apiResponse';
import {
	addAllowanceTransfer,
	deleteBudgetRecord,
	getBudgetRecordById,
	getPgPool,
	getTeamById,
	InsufficientFundsError,
} from '@/db';
import { publishEventQuiet } from '@/db/events';
import { verifyVaultAccess } from '@/lib/vaultAccess';
import { isValidDate } from '@/lib/budget';
import { MAX_AMOUNT_CENTS } from '@/types/budget';
import budgetContract from '@/apps/budget/budget.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export const MAX_BUDGET_AMOUNT = Math.min(MAX_AMOUNT_CENTS, budgetContract.limits.maxAmountPerTransaction);
export const MAX_BUDGET_DESC = budgetContract.limits.maxDescriptionLength;

/** Receipts are private uploads; anything else in this field could be a hostile link. */
export const RECEIPT_URL = /^\/api\/uploads\/[A-Za-z0-9._-]{1,120}$/;

export const formatCurrency = (minor: number) => `${(minor / 100).toFixed(2)} ₺`;

export const bad = (error: string, status = 400, code?: string) => jsonError(error, status, code);

/** `?teamId=` selects a project's vault; missing or `general` is the general vault. */
export function parseVault(value: unknown): string | null {
	return typeof value === 'string' && value && value !== 'general' ? value : null;
}

/** An optional transaction date: absent means "now"; otherwise within the accepted range. */
export function parseDate(
	value: unknown
): { ok: true; date?: number; error?: undefined } | { ok: false; error: string; date?: undefined } {
	if (value === undefined || value === null || value === '') return { ok: true };
	const date = Number(value);
	if (!isValidDate(date, Date.now())) {
		return { ok: false, error: 'Transaction date cannot be in the future or older than three years.' };
	}
	return { ok: true, date };
}

/** Allocation between two vaults — vault managers only, since it moves the club's money. */
export async function transferBudget(request: Request, body: Record<string, unknown>) {
	const access = await verifyVaultAccess(request, null, 'write');
	if (!access.authorized) return access.response;
	if (!access.isManagement) return bad('Transfers between vaults require vault management permission.', 403);

	const source = parseVault(body.source ?? body.sourceTeamId);
	const target = parseVault(body.target ?? body.targetTeamId);
	if (source === target) return bad('Source and target vaults cannot be the same.');
	for (const id of [source, target]) {
		if (id && !(await getTeamById(id))) return bad('Project not found.', 404);
	}
	const amountCents = Number(body.amountMinor);
	if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_BUDGET_AMOUNT) {
		return contractErrorResponse(
			budgetContract,
			'INVALID_AMOUNT',
			`Amount must be between 0.01 ₺ and ${formatCurrency(MAX_BUDGET_AMOUNT)}.`
		);
	}
	const description = typeof body.description === 'string' ? body.description.trim() : '';
	if (description.length < 3 || description.length > MAX_BUDGET_DESC) {
		return bad(`Description must be between 3 and ${MAX_BUDGET_DESC} characters.`);
	}
	const date = parseDate(body.date);
	if (!date.ok) return bad(date.error);

	try {
		const result = await addAllowanceTransfer({
			sourceTeamId: source,
			targetTeamId: target,
			amountMinor: amountCents,
			description,
			recorderId: access.user.id,
			date: date.date,
		});
		await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		if (error instanceof InsufficientFundsError) {
			return NextResponse.json(
				{
					error: `Source vault balance (${formatCurrency(error.netBalanceMinor)}) is insufficient for this transfer.`,
					code: 'INSUFFICIENT_FUNDS',
					netBalanceMinor: error.netBalanceMinor,
				},
				{ status: 409 }
			);
		}
		throw error;
	}
}

export async function deleteBudgetHandler(request: Request) {
	const id = new URL(request.url).searchParams.get('id');
	if (!id) return NextResponse.json({ error: 'Record ID is required.' }, { status: 400 });

	const registration = await getBudgetRecordById(id);
	const access = await verifyVaultAccess(request, registration?.teamId ?? null, 'write');
	if (!access.authorized) return access.response;

	if (!registration) {
		return contractErrorResponse(budgetContract, 'BUDGET_NOT_FOUND', 'Record not found or could not be deleted.');
	}
	if (registration.transferId && !access.isManagement) {
		return bad('Only vault managers can revert allowance transfers.', 403);
	}

	try {
		const deleted = await deleteBudgetRecord(id);
		if (!deleted) {
			return contractErrorResponse(budgetContract, 'BUDGET_NOT_FOUND', 'Record not found or could not be deleted.');
		}
		await publishEventQuiet(getPgPool(), { k: 'budget_updated' });
	} catch (error) {
		if (error instanceof InsufficientFundsError) {
			return NextResponse.json(
				{
					error: 'Deleting this income would take vault balance below zero; delete dependent expenses first.',
					code: 'INSUFFICIENT_FUNDS',
					netBalanceMinor: error.netBalanceMinor,
				},
				{ status: 409 }
			);
		}
		throw error;
	}

	return jsonSuccess({ success: true, message: 'Budget entry deleted.' });
}
