import type { ITerminalOptions, Terminal as XTerm } from '@xterm/xterm';
import { DARK_XTERM_THEME, LIGHT_XTERM_THEME } from '../components/themes';

export function buildXTermOptions(isLight: boolean): ITerminalOptions {
	return {
		cursorBlink: true,
		cursorStyle: 'block',
		fontFamily: 'Menlo, Monaco, "Courier New", monospace, Consolas',
		fontSize: 13,
		fontWeight: '500',
		fontWeightBold: '700',
		lineHeight: 1.25,
		letterSpacing: 0.5,
		drawBoldTextInBrightColors: true,
		minimumContrastRatio: 4.5,
		macOptionIsMeta: true,
		altClickMovesCursor: false,
		scrollback: 10000,
		convertEol: false,
		smoothScrollDuration: 0,
		theme: isLight ? LIGHT_XTERM_THEME : DARK_XTERM_THEME,
		allowProposedApi: true,
	};
}

export function attachTerminalKeyHandlers(term: XTerm): void {
	term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
		if (event.type !== 'keydown') return true;

		if (
			(event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'c' && term.hasSelection()) ||
			(!event.metaKey && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c' && term.hasSelection())
		) {
			return true;
		}

		if (
			(event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'v') ||
			(!event.metaKey && event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'v')
		) {
			return true;
		}

		if ((event.ctrlKey && !event.metaKey) || (event.altKey && !event.metaKey) || (event.ctrlKey && event.altKey)) {
			event.preventDefault();
			event.stopPropagation();
			return true;
		}

		if (event.key === 'Tab' || /^F\d+$/.test(event.key)) {
			event.preventDefault();
			event.stopPropagation();
			return true;
		}

		if (event.key === 'Escape') {
			event.stopPropagation();
			return true;
		}

		return true;
	});
}
