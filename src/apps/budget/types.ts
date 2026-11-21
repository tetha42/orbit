import type { VaultSummary } from '@/types/budget';
import type {
	BudgetCreateBody,
	BudgetPatchBody,
	BudgetRecordDto,
	BudgetTransferBody,
	CashTotals,
	VaultResponse,
} from '@/contracts/schemas/budget';

export type VaultRecord = BudgetRecordDto;
export type {
	BudgetCreateBody,
	BudgetPatchBody,
	BudgetTransferBody,
	CashTotals,
	VaultResponse,
	VaultSummary,
};

/** "general" or the project's id, for the transfer form. */
export const vaultKey = (teamId: string | null) => teamId ?? 'general';
