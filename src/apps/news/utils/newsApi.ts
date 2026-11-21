import newsContract from '../news.contract.json';
import type { NewsVisibility } from '@/types/news';
import type { NewsEntry } from '../types';

export function mapNewsContractError(
	t: (key: string, fallback?: string) => string,
	raw?: string,
	code?: string
): string | undefined {
	const matched = newsContract.errorCodes.find(
		(entry) => (code && entry.code === code) || (raw && raw.includes(entry.code))
	);
	return matched ? t(matched.i18nKey, matched.description) : raw;
}

export function validateNewsDraft(title: string, summary: string, content: string): 'missing' | 'too_long' | null {
	if (!title.trim() || !content.trim()) return 'missing';
	if (
		title.trim().length > newsContract.limits.maxTitleLength ||
		summary.trim().length > newsContract.limits.maxSummaryLength
	) {
		return 'too_long';
	}
	return null;
}

export async function saveNewsRequest(
	editingId: string | null,
	payload: {
		title: string;
		summary: string;
		content: string;
		category: string;
		isImportant: boolean;
		imageUrl: string;
		publishStatus: NewsVisibility;
	}
): Promise<{ ok: true; data: NewsEntry } | { ok: false; error?: string; code?: string }> {
	const res = await fetch('/api/news', {
		method: editingId ? 'PATCH' : 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...payload }),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		return { ok: false, error: errData.error, code: errData.code };
	}
	return { ok: true, data: await res.json() };
}
