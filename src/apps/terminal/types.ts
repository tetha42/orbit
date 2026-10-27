export type TerminalStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TerminalDimensions {
	cols: number;
	rows: number;
}

/** The Keyboard Lock API (Chromium), which lib.dom does not declare. */
export type NavigatorWithKeyboardLock = Navigator & {
	keyboard?: {
		lock?: () => Promise<void>;
		unlock?: () => void;
	};
};
