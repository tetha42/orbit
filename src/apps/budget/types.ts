import type { VaultSummary } from '@/types/budget';

export interface VaultRecord {
	id: string;
	date: number;
	creation?: number;
	typeValue: 'income' | 'expense';
	category: string;
	amountMinor: number;
	description: string;
	receiptPhotoUrl: string | null;
	recorderId: string;
	recorderNameSurname: string | null;
	transferId?: string | null;
	counterpartVaultName?: string | null;
	updaterNameSurname?: string | null;
	update?: number | null;
}

export interface CashTotals {
	totalIncomeMinor: number;
	totalExpenseMinor: number;
	netBalanceMinor: number;
	recordCount: number;
}

export interface VaultResponse {
	vault: { teamId: string | null; name: string; kind: 'general' | 'project' };
	records: VaultRecord[];
	summary: CashTotals;
	/** What the caller may do here (lib/kasaAccess): write entries; manage (transfers). */
	permission: { write: boolean; manage: boolean };
}

export type { VaultSummary };

/** "Genel Kasa" or the project's name, for the transfer form. */
export const vaultKey = (teamId: string | null) => teamId ?? 'general';
