/**
 * Global z-index stack & keyboard lock manager for desktop modals, sheets, and Zenity dialogs.
 *
 * The workspace store listens for global shortcuts (Esc, Ctrl+Space, window
 * switching…). While a dialog is open those must not fire — Esc should close the
 * topmost modal and nothing else — so modals register in a LIFO stack and receive
 * a managed z-index above all mini-app windows.
 */

export const BASE_MODAL_Z = 20000;
export const STEP_MODAL_Z = 20;
export const DIALOG_MODAL_Z = 50000;

interface StackEntry {
	id: number;
	zIndex: number;
}

let nextModalId = 1;
let stack: StackEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
	for (const fn of listeners) fn();
}

export interface ModalHandle {
	readonly id: number;
	readonly zIndex: number;
	release: () => void;
	bringToFront: () => number;
}

/**
 * Registers a modal surface in the global z-index stack.
 * Returns a handle with its assigned `zIndex`, `bringToFront()`, and `release()`.
 */
export function registerModal(baseZ = BASE_MODAL_Z): ModalHandle {
	const id = nextModalId++;
	const highestInTier = stack
		.filter((item) => (baseZ >= DIALOG_MODAL_Z ? item.zIndex >= DIALOG_MODAL_Z : item.zIndex < DIALOG_MODAL_Z))
		.reduce((max, item) => Math.max(max, item.zIndex), baseZ - STEP_MODAL_Z);
	const zIndex = Math.max(baseZ, highestInTier + STEP_MODAL_Z);

	stack = [...stack, { id, zIndex }];
	notify();

	let released = false;
	return {
		id,
		get zIndex() {
			return stack.find((x) => x.id === id)?.zIndex ?? zIndex;
		},
		bringToFront: () => {
			const tierItems = stack.filter((item) =>
				baseZ >= DIALOG_MODAL_Z ? item.zIndex >= DIALOG_MODAL_Z : item.zIndex < DIALOG_MODAL_Z
			);
			const currentTop = tierItems[tierItems.length - 1];
			if (!currentTop || currentTop.id === id) {
				return stack.find((x) => x.id === id)?.zIndex ?? zIndex;
			}
			const newZ = currentTop.zIndex + STEP_MODAL_Z;
			stack = [...stack.filter((x) => x.id !== id), { id, zIndex: newZ }];
			notify();
			return newZ;
		},
		release: () => {
			if (released) return;
			released = true;
			stack = stack.filter((x) => x.id !== id);
			notify();
		},
	};
}

/** Takes the lock for top-level alert/confirm/zenity dialogs; call the returned function once to release it. */
export function acquireModalLock(): () => void {
	return registerModal(DIALOG_MODAL_Z).release;
}

export function isModalLocked(): boolean {
	return stack.length > 0;
}

/** True only when `id` is the topmost modal currently open on the desktop. */
export function isTopModal(id: number): boolean {
	return stack.length > 0 && stack[stack.length - 1].id === id;
}

export function getModalZIndex(id: number, fallback = BASE_MODAL_Z): number {
	return stack.find((x) => x.id === id)?.zIndex ?? fallback;
}

export function subscribeModalStack(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
