/** Small DOM helpers shared by the window manager, search and notifications. */

/** True when the element takes typed text, so global shortcuts must leave it alone. */
export function isEditableElement(el: Element | null | undefined): boolean {
	if (!el) return false;
	const tag = el.tagName.toLowerCase();
	if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
	if ((el as HTMLElement).isContentEditable) return true;
	// xterm keeps a hidden <textarea> for input, but be explicit about the terminal.
	return !!el.closest('.xterm');
}

/** Escapes a value for use inside a quoted CSS attribute selector. */
export function attrValue(value: string): string {
	return value.replace(/["\\]/g, '\\$&');
}

/**
 * Scrolls `el` into view by moving only the scroll containers between it and
 * `root`.
 *
 * `Element.scrollIntoView` walks all the way up the tree, including ancestors that
 * are `overflow: hidden` — which is how it shifts the desktop root or the window
 * layer out from under the menu bar. Here the outermost container that moves is
 * the window's own content frame.
 */
export function scrollWithin(el: HTMLElement, root: HTMLElement): void {
	let node: HTMLElement | null = el.parentElement;
	while (node) {
		const style = getComputedStyle(node);
		const scrollable = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
		if (scrollable) {
			const nodeRect = node.getBoundingClientRect();
			const elRect = el.getBoundingClientRect();
			node.scrollTop += elRect.top - nodeRect.top - (node.clientHeight - elRect.height) / 2;
		}
		if (node === root) break;
		node = node.parentElement;
	}
}

/**
 * Scrolls `container` just far enough to bring `el` into view — nothing when it is
 * already visible. For keyboard navigation through a list, where re-centring the
 * row on every arrow press (as `scrollWithin` does) would make the list jump.
 */
export function scrollNearest(el: HTMLElement, container: HTMLElement): void {
	const box = container.getBoundingClientRect();
	const rect = el.getBoundingClientRect();
	if (rect.top < box.top) container.scrollTop -= box.top - rect.top;
	else if (rect.bottom > box.bottom) container.scrollTop += rect.bottom - box.bottom;
}

/**
 * Adds a class for a fixed time, restarting its CSS animation if it is already
 * running. Returns a function that ends the flash early.
 */
export function flashClass(el: Element, className: string, ms: number): () => void {
	el.classList.remove(className);
	// Reading layout forces the class removal to take effect, so re-adding it
	// replays the animation instead of being coalesced away.
	void (el as HTMLElement).offsetWidth;
	el.classList.add(className);
	const timer = setTimeout(() => el.classList.remove(className), ms);
	return () => {
		clearTimeout(timer);
		el.classList.remove(className);
	};
}

/** Glows the frame of an app's window for a moment. */
export function flashWindowFrame(appId: string, ms = 1000): void {
	const frame = document.querySelector<HTMLElement>(`[data-window-frame="${attrValue(appId)}"]`);
	if (frame) flashClass(frame, 'focus-flash--window', ms);
}

/** True when the user has selected text, i.e. when a right-click should offer "Copy". */
export function hasTextSelection(): boolean {
	const selection = window.getSelection();
	return !!selection && !selection.isCollapsed && selection.toString().trim().length > 0;
}
