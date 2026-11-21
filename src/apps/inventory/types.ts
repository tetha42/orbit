import type { InventoryStatus } from '@/types/inventory';
import type {
	InventoryCreateBody,
	InventoryItem,
	InventoryPatchBody,
	InventoryPostBody,
} from '@/contracts/schemas/inventory';

export type {
	InventoryCreateBody,
	InventoryItem,
	InventoryPatchBody,
	InventoryPostBody,
	InventoryStatus,
};

export type Filter = 'all' | InventoryStatus | 'overdue' | 'mine';

export const CATEGORY_SUGGESTION_KEYS = [
	'invCatDevBoard',
	'invCatEmbedded',
	'invCatSensor',
	'invCatTestEquip',
	'invCat3dPrinter',
	'invCatRobotics',
	'invCatNetwork',
	'invCatComputer',
	'invCatCables',
] as const;

export const trDate = (ms: number) =>
	new Date(ms).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
