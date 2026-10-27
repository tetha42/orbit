'use client';

/**
 * Opens a printable page in a new window and starts printing. The body is HTML
 * the caller has already escaped (see core/text/escape).
 *
 * Returns the window, or null when the browser blocked the pop-up. Callers that
 * need to fetch data first should call it *before* awaiting (inside the click),
 * pass `body: null` to show a "preparing" note, and fill it in with
 * `writePrintWindow` — browsers block pop-ups opened after an await.
 */
const BASE_CSS = `body{font:12px/1.45 system-ui,-apple-system,sans-serif;margin:28px;color:#111}
h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f2f2f2}
.n{text-align:right;white-space:nowrap}.muted{color:#666}`;

export function openPrintWindow(opts: { title: string; body: string | null; css?: string; width?: number; height?: number; print?: boolean }): Window | null {
	const w = window.open('', '_blank', `width=${opts.width ?? 900},height=${opts.height ?? 1000}`);
	if (!w) return null;
	writePrintWindow(w, { title: opts.title, body: opts.body ?? '<p class="muted">Hazırlanıyor…</p>', css: opts.css, print: opts.body !== null && opts.print !== false });
	return w;
}

export function writePrintWindow(w: Window, opts: { title: string; body: string; css?: string; print?: boolean }): void {
	const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
	w.document.open();
	w.document.write(
		`<!doctype html><meta charset="utf-8"><title>${esc(opts.title)}</title><style>${BASE_CSS}${opts.css ?? ''}</style>${opts.body}` +
			(opts.print === false ? '' : '<script>window.onload=()=>window.print()</script>')
	);
	w.document.close();
}
