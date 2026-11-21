/**
 * Canonical budget categories.
 *
 * Defined once so the form, the API and the stored type agree. The form
 * previously accepted free text while the type declared a fixed set — so any
 * category a user invented was silently outside the type and broke the
 * per-category summaries.
 */
export const BUDGET_CATEGORIES = [
	'catering',
	'printing',
	'sponsorship',
	'hardware',
	'transport',
	'other',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const BUDGET_CATEGORY_ALIASES: Record<string, BudgetCategory> = {
	catering: 'catering',
	refreshments: 'catering',
	food: 'catering',
	printing: 'printing',
	print: 'printing',
	poster: 'printing',
	marketing: 'printing',
	sponsorship: 'sponsorship',
	sponsor: 'sponsorship',
	hardware: 'hardware',
	equipment: 'hardware',
	transport: 'transport',
	transportation: 'transport',
	travel: 'transport',
	other: 'other',
};

export function normalizeBudgetCategory(value: unknown): BudgetCategory | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if ((BUDGET_CATEGORIES as readonly string[]).includes(trimmed)) return trimmed as BudgetCategory;
	const lower = trimmed.toLowerCase();
	return BUDGET_CATEGORY_ALIASES[lower] ?? null;
}

/**
 * The category of the two rows an allocation writes (one in each vault). It is not
 * in BUDGET_CATEGORIES on purpose: an ordinary entry cannot claim to be one.
 */
export const TRANSFER_CATEGORY = 'allowance_transfer' as const;

/** Any category a stored row can carry. */
export type BudgetRecordCategory = BudgetCategory | typeof TRANSFER_CATEGORY;

export function isBudgetCategory(value: unknown): value is BudgetCategory {
	return typeof value === 'string' && (BUDGET_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Largest single entry: 20,000,000 TRY in minor units (1/100 of a lira).
 * `amountMinor` is a 32-bit INTEGER column, so this also keeps a sum of entries
 * from ever overflowing it.
 */
export const MAX_AMOUNT_CENTS = 2_000_000_000;

/** One cash box: the club's general vault, or the vault of a single project (team). */
export interface VaultSummary {
	/** `null` is the general vault. */
	teamId: string | null;
	name: string;
	kind: 'general' | 'project';
	totalIncomeMinor: number;
	totalExpenseMinor: number;
	netBalanceMinor: number;
	recordCount: number;
}
