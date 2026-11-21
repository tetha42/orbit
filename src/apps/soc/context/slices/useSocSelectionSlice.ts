'use client';

import { useCallback } from 'react';

export function useSocSelectionSlice() {
	const handleSelectDataOnDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation();
		const target = e.currentTarget;
		const selection = window.getSelection();
		if (!selection) return;

		const range = document.createRange();
		range.selectNodeContents(target);
		selection.removeAllRanges();
		selection.addRange(range);
	}, []);

	const handleDataContainerDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
		const target = e.target as HTMLElement;
		if (!target) return;

		if (target.closest('button, input, select, textarea, a')) {
			return;
		}

		const selection = window.getSelection();
		if (!selection) return;

		const tokenEl = target.closest<HTMLElement>('[data-type], [data-selectable="true"]');
		if (tokenEl) {
			e.stopPropagation();
			const range = document.createRange();
			range.selectNodeContents(tokenEl);
			selection.removeAllRanges();
			selection.addRange(range);
			return;
		}

		const textEl = target.closest<HTMLElement>('td, pre, code');
		if (textEl) {
			const elToSelect =
				target !== textEl && target.textContent?.trim() === target.innerText?.trim()
					? target
					: textEl;
			const range = document.createRange();
			range.selectNodeContents(elToSelect);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}, []);

	return {
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
	};
}
