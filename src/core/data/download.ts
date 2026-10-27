'use client';

import { toCsv } from '@/lib/events';

/** Saves a Blob under `name` through a temporary link. */
export function downloadBlob(blob: Blob, name: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	// Let the click start the download before the URL goes away.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Excel-friendly CSV: `;`-separated, formula cells neutralised (toCsv), and a
 * BOM so Turkish letters open correctly. `name` gets today's date appended.
 */
export function downloadCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]): void {
	const safe = name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'liste';
	downloadBlob(new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }), `${safe}_${new Date().toISOString().slice(0, 10)}.csv`);
}
