/**
 * Canonical inventory status vocabulary.
 *
 * Three different sets had grown up independently — the UI compared against
 * `'oduncte'`, the API wrote `'odunc_verildi'`, and the storage type mentioned
 * `'onarimda'`. A borrowed item therefore matched nothing and rendered under the
 * "ARIZALI" label.
 *
 * Both the API and the UI import from here so this cannot drift again.
 */
export const INVENTORY_STATUSES = ['available', 'on_loan', 'faulty', 'lost'] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

/** Status labels for badges and filters. */
export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
	available: 'AVAILABLE',
	on_loan: 'ON LOAN',
	faulty: 'FAULTY',
	lost: 'LOST',
};

/** Filter labels, including the "show everything" option. */
export const INVENTORY_FILTER_LABELS: Record<InventoryStatus | 'all', string> = {
	all: 'All',
	available: 'Available',
	on_loan: 'On Loan',
	faulty: 'Faulty',
	lost: 'Lost',
};

export function isInventoryStatus(value: unknown): value is InventoryStatus {
	return typeof value === 'string' && (INVENTORY_STATUSES as readonly string[]).includes(value);
}

/** True when the item is on the shelf rather than lent out or out of service. */
export function isAvailable(status: string | null | undefined): boolean {
	return status === 'available';
}
