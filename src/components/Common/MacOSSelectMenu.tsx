'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
	computeSelectCoords,
	parseSelectChildren,
	setReactSelectValue,
	type ParsedSelectItem,
	type SelectPopupCoords,
} from './macosSelect/selectDom';
import { SelectPopupList } from './macosSelect/SelectPopupList';

/**
 * System-wide macOS context-menu style dropdown replacement for all <select> elements.
 */
export function MacOSSelectMenu() {
	const [activeSelect, setActiveSelect] = useState<HTMLSelectElement | null>(null);
	const [items, setItems] = useState<ParsedSelectItem[]>([]);
	const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
	const [coords, setCoords] = useState<SelectPopupCoords>({
		top: 0,
		left: 0,
		width: 200,
		maxHeight: 280,
	});

	const menuRef = useRef<HTMLDivElement | null>(null);
	const activeSelectRef = useRef<HTMLSelectElement | null>(null);

	const closeMenu = useCallback(() => {
		if (activeSelectRef.current) {
			activeSelectRef.current.removeAttribute('data-macos-select-open');
		}
		activeSelectRef.current = null;
		setActiveSelect(null);
	}, []);

	const updatePositionAndItems = useCallback((selectEl: HTMLSelectElement) => {
		const rect = selectEl.getBoundingClientRect();
		const parsed = parseSelectChildren(selectEl);
		setItems(parsed);

		const selectedIdx = parsed.findIndex((it) => it.type === 'option' && it.selected);
		setHoveredIndex(selectedIdx >= 0 ? selectedIdx : parsed.findIndex((it) => it.type === 'option' && !it.disabled));
		setCoords(computeSelectCoords(rect, parsed.length));
	}, []);

	const openForSelect = useCallback(
		(selectEl: HTMLSelectElement) => {
			if (activeSelectRef.current && activeSelectRef.current !== selectEl) {
				activeSelectRef.current.removeAttribute('data-macos-select-open');
			}
			activeSelectRef.current = selectEl;
			selectEl.setAttribute('data-macos-select-open', 'true');
			setActiveSelect(selectEl);
			updatePositionAndItems(selectEl);
		},
		[updatePositionAndItems]
	);

	useEffect(() => {
		const handleMouseDown = (e: MouseEvent) => {
			const target = e.target as Element | null;
			if (!target) return;
			if (menuRef.current && menuRef.current.contains(target)) return;

			const selectEl = target.closest?.('select') as HTMLSelectElement | null;
			if (!selectEl || selectEl.disabled || selectEl.multiple || selectEl.size > 1) {
				if (activeSelectRef.current) closeMenu();
				return;
			}
			if (e.button !== 0) return;

			e.preventDefault();
			e.stopPropagation();
			selectEl.focus({ preventScroll: true });

			if (activeSelectRef.current === selectEl) closeMenu();
			else openForSelect(selectEl);
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			const current = activeSelectRef.current;
			if (current) {
				if (e.key === 'Escape' || e.key === 'Tab') {
					if (e.key === 'Escape') {
						e.preventDefault();
						e.stopPropagation();
					}
					closeMenu();
					return;
				}
				if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
					e.preventDefault();
					e.stopPropagation();
					setItems((prevItems) => {
						const enabledIndices = prevItems
							.map((it, idx) => (it.type === 'option' && !it.disabled ? idx : -1))
							.filter((idx) => idx >= 0);
						if (enabledIndices.length === 0) return prevItems;
						setHoveredIndex((prevHover) => {
							const pos = enabledIndices.indexOf(prevHover);
							return e.key === 'ArrowDown'
								? enabledIndices[pos < enabledIndices.length - 1 ? pos + 1 : 0]
								: enabledIndices[pos > 0 ? pos - 1 : enabledIndices.length - 1];
						});
						return prevItems;
					});
					return;
				}
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					e.stopPropagation();
					const item = items[hoveredIndex];
					if (item && item.type === 'option' && !item.disabled && item.value !== undefined) {
						setReactSelectValue(current, item.value, item.optionIndex);
						closeMenu();
					}
					return;
				}
				return;
			}

			const focused = document.activeElement;
			if (focused && focused.tagName === 'SELECT') {
				const selectEl = focused as HTMLSelectElement;
				if (!selectEl.disabled && !selectEl.multiple && selectEl.size <= 1) {
					if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
						e.preventDefault();
						e.stopPropagation();
						openForSelect(selectEl);
					}
				}
			}
		};

		const handleScrollOrResize = (e: Event) => {
			if (!activeSelectRef.current) return;
			if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
			closeMenu();
		};

		window.addEventListener('mousedown', handleMouseDown, true);
		window.addEventListener('keydown', handleKeyDown, true);
		window.addEventListener('resize', handleScrollOrResize, true);
		window.addEventListener('scroll', handleScrollOrResize, true);

		return () => {
			window.removeEventListener('mousedown', handleMouseDown, true);
			window.removeEventListener('keydown', handleKeyDown, true);
			window.removeEventListener('resize', handleScrollOrResize, true);
			window.removeEventListener('scroll', handleScrollOrResize, true);
		};
	}, [closeMenu, openForSelect, items, hoveredIndex]);

	useEffect(() => {
		if (!activeSelect) return;
		const observer = new MutationObserver(() => {
			if (!document.body.contains(activeSelect)) {
				closeMenu();
				return;
			}
			updatePositionAndItems(activeSelect);
		});
		observer.observe(activeSelect, { childList: true, subtree: true, attributes: true });
		return () => observer.disconnect();
	}, [activeSelect, closeMenu, updatePositionAndItems]);

	useLayoutEffect(() => {
		if (!activeSelect || !menuRef.current || hoveredIndex < 0) return;
		const row = menuRef.current.querySelector(`[data-select-idx="${hoveredIndex}"]`) as HTMLElement | null;
		if (row) row.scrollIntoView({ block: 'nearest' });
	}, [activeSelect, hoveredIndex]);

	if (!activeSelect || typeof document === 'undefined') return null;

	return (
		<SelectPopupList
			menuRef={menuRef}
			coords={coords}
			items={items}
			hoveredIndex={hoveredIndex}
			onHover={setHoveredIndex}
			onSelect={(item) => {
				if (item.value !== undefined) {
					setReactSelectValue(activeSelect, item.value, item.optionIndex);
					closeMenu();
				}
			}}
		/>
	);
}
