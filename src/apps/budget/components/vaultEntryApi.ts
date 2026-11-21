import { sendJson } from '@/core/data/http';
import { compressImageToWebp } from '@/lib/client/imageCompress';
import { orbitBus } from '@/core/ipc/orbitBus';

export async function uploadVaultReceiptImage(file: File): Promise<{ url?: string; error?: string }> {
	const compressed = await compressImageToWebp(file, 1280, 0.85);
	const fd = new FormData();
	const fileName = compressed.type === 'image/webp' ? 'receipt.webp' : file.name || 'receipt.jpg';
	fd.append('file', compressed, fileName);
	const res = await fetch('/api/upload', { method: 'POST', body: fd });
	const body = await res.json().catch(() => ({}));
	if (res.ok && body.url) return { url: body.url };
	return { error: body.error };
}

export interface SaveVaultEntryInput {
	editingId?: string;
	transfer: boolean;
	teamId: string | null;
	type: 'income' | 'expense';
	category: string;
	amountMinor: number | null;
	description: string;
	dateMs: number;
	receiptUrl: string | null;
}

export async function saveVaultEntry(input: SaveVaultEntryInput) {
	if (input.editingId) {
		return sendJson('/api/budget', 'PATCH', {
			id: input.editingId,
			description: input.description,
			date: input.dateMs,
			...(input.transfer ? {} : { category: input.category, receiptUrl: input.receiptUrl }),
		});
	}
	const res = await sendJson('/api/budget', 'POST', {
		teamId: input.teamId,
		type: input.type,
		category: input.category,
		amountMinor: input.amountMinor,
		description: input.description,
		date: input.dateMs,
		receiptUrl: input.receiptUrl || undefined,
	});
	if (res.ok) {
		orbitBus.emit('budget:record_created', {
			recordId: String((res.data as Record<string, unknown>)?.id || ''),
			amount: input.amountMinor ?? 0,
			type: input.type,
			teamId: input.teamId || undefined,
		});
	}
	return res;
}
