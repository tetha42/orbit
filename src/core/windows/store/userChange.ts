/**
 * Announces that the member themselves changed the desktop (opened, closed, moved a
 * window). Workspace persistence listens so a slow roaming answer cannot replace what
 * they just did with an older layout.
 */
export function markUserWindowChange(): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('workspace:user-changed'));
}
