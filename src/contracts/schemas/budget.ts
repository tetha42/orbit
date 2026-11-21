import { z } from 'zod';
import { BUDGET_CATEGORIES, MAX_AMOUNT_CENTS, TRANSFER_CATEGORY, normalizeBudgetCategory } from '@/types/budget';
import { isValidDate } from '@/lib/budget';
import budgetContract from '@/apps/budget/budget.contract.json';

export const BUDGET_MAX_AMOUNT = Math.min(MAX_AMOUNT_CENTS, budgetContract.limits.maxAmountPerTransaction);
export const BUDGET_MAX_DESC = budgetContract.limits.maxDescriptionLength;
export const BUDGET_RECEIPT_URL_RE = /^\/api\/uploads\/[A-Za-z0-9._-]{1,120}$/;
const INVALID_DATE_MSG = 'Transaction date cannot be in the future or older than three years.';

export const resolveBudgetVault = (value: string | null | undefined): string | null =>
	typeof value === 'string' && value.length > 0 && value !== 'general' ? value : null;

export const BudgetEntryTypeSchema = z.enum(['income', 'expense']);
export const BudgetCategorySchema = z.enum(BUDGET_CATEGORIES);
export const BudgetRecordCategorySchema = z.union([BudgetCategorySchema, z.literal(TRANSFER_CATEGORY)]);

const BudgetCategoryInputSchema = z.string().transform((raw, ctx) => {
	const resolved = normalizeBudgetCategory(raw);
	if (!resolved) {
		ctx.addIssue({ code: 'custom', message: `Invalid category. Expected: ${BUDGET_CATEGORIES.join(', ')}` });
		return z.NEVER;
	}
	return resolved;
});

const BudgetReceiptStringSchema = z.string().refine((v) => !v || BUDGET_RECEIPT_URL_RE.test(v), {
	message: 'Invalid receipt file.',
});
const BudgetDateValueSchema = z.union([z.number(), z.string(), z.null()]).optional();

function parseValidDate(raw: number | string | null | undefined, required: boolean, ctx: z.RefinementCtx): number | undefined {
	if (raw === undefined || raw === null || raw === '') {
		if (required) ctx.addIssue({ code: 'custom', path: ['date'], message: INVALID_DATE_MSG });
		return undefined;
	}
	const ms = Number(raw);
	if (!isValidDate(ms, Date.now())) {
		ctx.addIssue({ code: 'custom', path: ['date'], message: INVALID_DATE_MSG });
		return undefined;
	}
	return ms;
}

export const BudgetGetQuerySchema = z.object({ teamId: z.string().optional() });
export const BudgetDeleteQuerySchema = z.object({ id: z.string().trim().min(1, 'Record ID is required.') });

export const BudgetCreateBodySchema = z
	.object({
		teamId: z.string().nullable().optional(),
		type: BudgetEntryTypeSchema.optional(),
		typeValue: BudgetEntryTypeSchema.optional(),
		category: BudgetCategoryInputSchema,
		amountMinor: z.number().int().min(1).max(BUDGET_MAX_AMOUNT),
		description: z.string().trim().min(1).max(BUDGET_MAX_DESC),
		date: BudgetDateValueSchema,
		receiptUrl: BudgetReceiptStringSchema.nullable().optional(),
		receiptPhotoUrl: BudgetReceiptStringSchema.nullable().optional(),
	})
	.transform((val, ctx) => {
		const type = val.type ?? val.typeValue;
		if (!type) {
			ctx.addIssue({ code: 'custom', path: ['type'], message: "Type must be 'income' or 'expense'." });
			return z.NEVER;
		}
		const date = parseValidDate(val.date, false, ctx);
		const receiptUrl = (val.receiptUrl ?? val.receiptPhotoUrl) || undefined;
		return { teamId: resolveBudgetVault(val.teamId), type, category: val.category, amountMinor: val.amountMinor, description: val.description, date, receiptUrl };
	});

export const BudgetPatchBodySchema = z
	.object({
		id: z.string().trim().min(1, 'Record ID is required.'),
		description: z.string().trim().min(1).max(BUDGET_MAX_DESC).optional(),
		category: BudgetCategoryInputSchema.optional(),
		date: BudgetDateValueSchema,
		receiptUrl: BudgetReceiptStringSchema.nullable().optional(),
		receiptPhotoUrl: BudgetReceiptStringSchema.nullable().optional(),
		amountMinor: z.unknown().optional(),
		type: z.unknown().optional(),
		typeValue: z.unknown().optional(),
	})
	.transform((val, ctx) => {
		if (val.amountMinor !== undefined || val.type !== undefined || val.typeValue !== undefined) {
			ctx.addIssue({ code: 'custom', message: 'Amount and type cannot be changed; delete the entry and create a new one.' });
			return z.NEVER;
		}
		const date = val.date !== undefined ? parseValidDate(val.date, true, ctx) : undefined;
		const rawReceipt = val.receiptUrl !== undefined ? val.receiptUrl : val.receiptPhotoUrl;
		return { id: val.id, description: val.description, category: val.category, date, receiptUrl: rawReceipt === undefined ? undefined : rawReceipt || null };
	});

export const BudgetTransferBodySchema = z
	.object({
		action: z.literal('transfer'),
		source: z.string().nullable().optional(),
		sourceTeamId: z.string().nullable().optional(),
		target: z.string().nullable().optional(),
		targetTeamId: z.string().nullable().optional(),
		amountMinor: z.number().int().min(1).max(BUDGET_MAX_AMOUNT),
		description: z.string().trim().min(3).max(BUDGET_MAX_DESC),
		date: BudgetDateValueSchema,
	})
	.transform((val, ctx) => {
		const sourceTeamId = resolveBudgetVault(val.source ?? val.sourceTeamId);
		const targetTeamId = resolveBudgetVault(val.target ?? val.targetTeamId);
		if (sourceTeamId === targetTeamId) {
			ctx.addIssue({ code: 'custom', path: ['target'], message: 'Source and target vaults cannot be the same.' });
			return z.NEVER;
		}
		const date = parseValidDate(val.date, false, ctx);
		return { action: 'transfer' as const, sourceTeamId, targetTeamId, amountMinor: val.amountMinor, description: val.description, date };
	});

export const BudgetRecordSchema = z.object({
	id: z.string(), date: z.number(), createdAt: z.number().optional(), type: BudgetEntryTypeSchema,
	category: z.string(), amountMinor: z.number(), description: z.string(), receiptUrl: z.string().nullable().optional(),
	recorderId: z.string(), recorderName: z.string().nullable().optional(), teamId: z.string().nullable().optional(),
	transferId: z.string().nullable().optional(), counterpartVaultName: z.string().nullable().optional(),
	updaterId: z.string().nullable().optional(), updaterName: z.string().nullable().optional(), updatedAt: z.number().nullable().optional(),
});

export const CashTotalsSchema = z.object({
	totalIncomeMinor: z.number(), totalExpenseMinor: z.number(), netBalanceMinor: z.number(), recordCount: z.number(),
});

export const BudgetGetResponseSchema = z.object({
	vault: z.object({ teamId: z.string().nullable(), name: z.string(), kind: z.enum(['general', 'project']) }),
	permission: z.object({ write: z.boolean(), manage: z.boolean() }),
	records: z.array(BudgetRecordSchema),
	summary: CashTotalsSchema,
});

export type BudgetCreateBody = z.infer<typeof BudgetCreateBodySchema>;
export type BudgetPatchBody = z.infer<typeof BudgetPatchBodySchema>;
export type BudgetTransferBody = z.infer<typeof BudgetTransferBodySchema>;
export type BudgetRecordDto = z.infer<typeof BudgetRecordSchema>;
export type CashTotals = z.infer<typeof CashTotalsSchema>;
export type VaultResponse = z.infer<typeof BudgetGetResponseSchema>;
