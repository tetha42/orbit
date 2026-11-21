import type { SearchMatchRange } from './types';

function collectTermRanges(haystackLower: string, termLower: string): SearchMatchRange[] {
	const ranges: SearchMatchRange[] = [];
	if (!termLower) return ranges;
	let pos = 0;
	while (pos < haystackLower.length) {
		const idx = haystackLower.indexOf(termLower, pos);
		if (idx === -1) break;
		ranges.push({ start: idx, end: idx + termLower.length });
		pos = idx + Math.max(1, termLower.length);
	}
	return ranges;
}

function mergeRanges(ranges: SearchMatchRange[]): SearchMatchRange[] {
	if (ranges.length <= 1) return ranges;
	const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
	const merged: SearchMatchRange[] = [sorted[0]];
	for (let i = 1; i < sorted.length; i++) {
		const prev = merged[merged.length - 1];
		const curr = sorted[i];
		if (curr.start <= prev.end) {
			prev.end = Math.max(prev.end, curr.end);
		} else {
			merged.push({ ...curr });
		}
	}
	return merged;
}

export function buildSearchSnippet(
	rawContent: string,
	rawQuery: string,
	maxLength = 160
): { snippet: string; matches: SearchMatchRange[] } {
	const normalized = rawContent.replace(/\s+/g, ' ').trim();
	const query = rawQuery.replace(/\s+/g, ' ').trim();
	if (!normalized) return { snippet: '', matches: [] };
	if (!query) return { snippet: normalized.slice(0, maxLength), matches: [] };

	const lowerText = normalized.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const tokens = lowerQuery
		.split(/\s+/)
		.map((t) => t.trim())
		.filter((t) => t.length >= 2);
	const searchTerms = tokens.length > 0 ? [lowerQuery, ...tokens] : [lowerQuery];

	let anchorIdx = lowerText.indexOf(lowerQuery);
	if (anchorIdx === -1) {
		for (const term of searchTerms) {
			const idx = lowerText.indexOf(term);
			if (idx !== -1 && (anchorIdx === -1 || idx < anchorIdx)) {
				anchorIdx = idx;
			}
		}
	}

	let windowStart = 0;
	let windowEnd = Math.min(normalized.length, maxLength);
	if (normalized.length > maxLength && anchorIdx !== -1) {
		const half = Math.floor(maxLength / 2);
		windowStart = Math.max(0, anchorIdx - Math.floor(half * 0.6));
		windowEnd = Math.min(normalized.length, windowStart + maxLength);
		if (windowEnd - windowStart < maxLength) {
			windowStart = Math.max(0, windowEnd - maxLength);
		}
	}

	const hasPrefix = windowStart > 0;
	const hasSuffix = windowEnd < normalized.length;
	const slice = normalized.slice(windowStart, windowEnd);
	const snippet = `${hasPrefix ? '…' : ''}${slice}${hasSuffix ? '…' : ''}`;
	const snippetLower = snippet.toLowerCase();

	const rawRanges: SearchMatchRange[] = [];
	const exactRanges = collectTermRanges(snippetLower, lowerQuery);
	if (exactRanges.length > 0) {
		rawRanges.push(...exactRanges);
	} else {
		for (const token of tokens) {
			rawRanges.push(...collectTermRanges(snippetLower, token));
		}
	}

	return { snippet, matches: mergeRanges(rawRanges) };
}
