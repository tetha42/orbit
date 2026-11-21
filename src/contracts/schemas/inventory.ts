import { z } from 'zod';
import { INVENTORY_STATUSES } from '@/types/inventory';
import { codeProblem, normalizeCode } from '@/lib/inventory';
import inventoryContract from '@/apps/inventory/inventory.contract.json';

export const INVENTORY_MAX_CODE_LEN = inventoryContract.limits.maxCodeLength;
export const INVENTORY_MAX_NAME_LEN = Math.min(120, inventoryContract.limits.maxNameLength);

export const InventoryStatusSchema = z.enum(INVENTORY_STATUSES);
export const InventoryManageableStatusSchema = z.enum(['available', 'faulty', 'lost']);
export const InventoryQuerySchema = z.object({ history: z.string().optional() });

const InventoryCodeSchema = z.string().transform((raw, ctx) => {
	const code = normalizeCode(raw);
	if (code.length > INVENTORY_MAX_CODE_LEN) {
		ctx.addIssue({
			code: 'custom',
			message: `Code can be at most ${INVENTORY_MAX_CODE_LEN} characters.`,
		});
		return z.NEVER;
	}
	const err = codeProblem(code);
	if (err) {
		ctx.addIssue({ code: 'custom', message: err });
		return z.NEVER;
	}
	return code;
});

const optionalNullableTrimmed = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullable()
		.optional()
		.transform((v) => (v === undefined ? undefined : v || null));

export const InventoryCreateBodySchema = z.object({
	action: z.literal('create'),
	code: InventoryCodeSchema,
	name: z.string().trim().min(3).max(INVENTORY_MAX_NAME_LEN),
	category: z.string().trim().min(2).max(60),
	location: z.string().trim().min(2).max(120),
	description: optionalNullableTrimmed(1000),
	serialNo: optionalNullableTrimmed(80),
	seriesNo: optionalNullableTrimmed(80),
	status: InventoryManageableStatusSchema.optional(),
});

export const InventoryPatchBodySchema = z.object({
	action: z.literal('update'),
	inventoryId: z.string().trim().min(1, 'Inventory ID is required.'),
	code: InventoryCodeSchema.optional(),
	name: z.string().trim().min(3).max(INVENTORY_MAX_NAME_LEN).optional(),
	category: z.string().trim().min(2).max(60).optional(),
	location: z.string().trim().min(2).max(120).optional(),
	description: optionalNullableTrimmed(1000),
	serialNo: optionalNullableTrimmed(80),
	seriesNo: optionalNullableTrimmed(80),
});

export const InventoryDeleteBodySchema = z.object({
	action: z.literal('delete'),
	inventoryId: z.string().trim().min(1, 'Inventory ID is required.'),
});

export const InventoryBorrowBodySchema = z.object({
	action: z.literal('borrow'),
	inventoryId: z.string().trim().min(1, 'Inventory ID is required.'),
	userId: z.string().optional(),
	dueDate: z.number().finite().optional(),
	returnDate: z.number().finite().optional(),
});

export const InventoryReturnBodySchema = z.object({
	action: z.literal('return'),
	inventoryId: z.string().trim().min(1, 'Inventory ID is required.'),
	failure: z.boolean().optional(),
	note: optionalNullableTrimmed(500),
	not: optionalNullableTrimmed(500),
});

export const InventoryExtendBodySchema = z
	.object({
		action: z.literal('extend'),
		inventoryId: z.string().trim().min(1, 'Inventory ID is required.'),
		dueDate: z.number().finite().optional(),
		returnDate: z.number().finite().optional(),
	})
	.superRefine((val, ctx) => {
		if (val.dueDate === undefined && val.returnDate === undefined) {
			ctx.addIssue({
				code: 'custom',
				path: ['dueDate'],
				message: 'Due date is required to extend a loan.',
			});
		}
	});

export const InventoryUpdateStatusBodySchema = z.object({
	action: z.literal('updateStatus'),
	inventoryId: z.string().trim().min(1, 'Inventory ID is required.'),
	status: InventoryManageableStatusSchema,
	note: optionalNullableTrimmed(500),
	not: optionalNullableTrimmed(500),
});

export const InventoryPostBodySchema = z.discriminatedUnion('action', [
	InventoryCreateBodySchema,
	InventoryPatchBodySchema,
	InventoryDeleteBodySchema,
	InventoryBorrowBodySchema,
	InventoryReturnBodySchema,
	InventoryExtendBodySchema,
	InventoryUpdateStatusBodySchema,
]);

export const InventoryItemSchema = z.object({
	id: z.string(),
	code: z.string(),
	name: z.string(),
	category: z.string(),
	status: InventoryStatusSchema,
	location: z.string(),
	holderUserId: z.string().nullable(),
	holderName: z.string().nullable(),
	dueDate: z.number().nullable(),
	loanDate: z.number().nullable(),
	description: z.string().nullable(),
	serialNo: z.string().nullable(),
});

export const InventoryListResponseSchema = z.array(InventoryItemSchema);

export type InventoryCreateBody = z.infer<typeof InventoryCreateBodySchema>;
export type InventoryPatchBody = z.infer<typeof InventoryPatchBodySchema>;
export type InventoryPostBody = z.infer<typeof InventoryPostBodySchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
