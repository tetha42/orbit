'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

interface ParsedSelectItem {
	type: 'option' | 'group' | 'separator';
	value?: string;
	label: string;
	disabled?: boolean;
	selected?: boolean;
	optionIndex?: number;
}

function parseSelectChildren(selectEl: HTMLSelectElement): ParsedSelectItem[] {
	const items: ParsedSelectItem[] = [];
	const currentVal = selectEl.value;
	let optCounter = 0;

	const children = Array.from(selectEl.children);
	children.forEach((child, childIdx) => {
		if (child.tagName === 'OPTGROUP') {
			const group = child as HTMLOptGroupElement;
			if (items.length > 0) {
				items.push({ type: 'separator', label: `sep-${childIdx}` });
			}
			if (group.label) {
				items.push({ type: 'group', label: group.label });
			}
			Array.from(group.children).forEach((optChild) => {
				if (optChild.tagName === 'OPTION') {
					const opt = optChild as HTMLOptionElement;
					const idx = optCounter++;
					items.push({
						type: 'option',
						value: opt.value,
						label: opt.label || opt.textContent || '',
						disabled: opt.disabled || group.disabled,
						selected: opt.value === currentVal && selectEl.selectedIndex === idx,
						optionIndex: idx,
					});
				}
			});
		} else if (child.tagName === 'OPTION') {
			const opt = child as HTMLOptionElement;
			const idx = optCounter++;
			items.push({
				type: 'option',
				value: opt.value,
				label: opt.label || opt.textContent || '',
				disabled: opt.disabled,
				selected: opt.value === currentVal && (selectEl.selectedIndex === idx || selectEl.selectedIndex === -1),
				optionIndex: idx,
			});
		}
	});

	return items;
}

function setReactSelectValue(selectEl: HTMLSelectElement, nextValue: string, optionIndex?: number) {
	const proto = HTMLSelectElement.prototype;
	const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
	const tracker = (selectEl as HTMLSelectElement & { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
	if (tracker) {
		tracker.setValue(selectEl.value);
	}
	if (typeof optionIndex === 'number' && optionIndex >= 0) {
		selectEl.selectedIndex = optionIndex;
	}
	if (descriptor?.set) {
		descriptor.set.call(selectEl, nextValue);
	} else {
		selectEl.value = nextValue;
	}
	selectEl.dispatchEvent(new Event('input', { bubbles: true }));
	selectEl.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * System-wide macOS context-menu style dropdown replacement for all <select> elements.
 *
 * Intercepts user pointer/keyboard activation on any native <select>, prevents the
 * OS-default white popup menu, and renders a frosted macOS menu matching MacOSMenu.tsx
 * while keeping the underlying <select> in the DOM for forms, accessibility, and E2E tests.
 */
export function MacOSSelectMenu() {
	const [activeSelect, setActiveSelect] = useState<HTMLSelectElement | null>(null);
	const [items, setItems] = useState<ParsedSelectItem[]>([]);
	const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
	const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({
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

		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const width = Math.max(rect.width, 180);
		const left = Math.max(8, Math.min(rect.left, vw - width - 8));

		const spaceBelow = vh - rect.bottom - 12;
		const spaceAbove = rect.top - 36;
		const estimatedHeight = Math.min(300, parsed.length * 28 + 12);

		if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
			setCoords({
				bottom: vh - rect.top + 5,
				left,
				width,
				maxHeight: Math.max(120, Math.min(300, spaceAbove)),
			});
		} else {
			setCoords({
				top: rect.bottom + 5,
				left,
				width,
				maxHeight: Math.max(120, Math.min(300, spaceBelow)),
			});
		}
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

	// Global event interception for all <select> elements
	useEffect(() => {
		const handleMouseDown = (e: MouseEvent) => {
			const target = e.target as Element | null;
			if (!target) return;

			// Click inside the open popup menu itself: let button onClick handle it
			if (menuRef.current && menuRef.current.contains(target)) {
				return;
			}

			const selectEl = target.closest?.('select') as HTMLSelectElement | null;
			if (!selectEl || selectEl.disabled || selectEl.multiple || selectEl.size > 1) {
				if (activeSelectRef.current) {
					closeMenu();
				}
				return;
			}

			if (e.button !== 0) return;

			// Prevent browser's native OS white dropdown menu from opening
			e.preventDefault();
			e.stopPropagation();
			selectEl.focus({ preventScroll: true });

			if (activeSelectRef.current === selectEl) {
				closeMenu();
			} else {
				openForSelect(selectEl);
			}
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
							if (e.key === 'ArrowDown') {
								return enabledIndices[pos < enabledIndices.length - 1 ? pos + 1 : 0];
							} else {
								return enabledIndices[pos > 0 ? pos - 1 : enabledIndices.length - 1];
							}
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

			// When focus is on a closed <select> and user presses Space/Enter/ArrowDown/ArrowUp
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
			if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
				return;
			}
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

	// Watch active <select> for dynamic option mutations or unmount
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

	// Scroll active/hovered option into view on open
	useLayoutEffect(() => {
		if (!activeSelect || !menuRef.current || hoveredIndex < 0) return;
		const row = menuRef.current.querySelector(`[data-select-idx="${hoveredIndex}"]`) as HTMLElement | null;
		if (row) {
			row.scrollIntoView({ block: 'nearest' });
		}
	}, [activeSelect, hoveredIndex]);

	if (!activeSelect || typeof document === 'undefined') return null;

	return createPortal(
		<div
			ref={menuRef}
			data-menu
			data-macos-select-popup
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			style={{
				position: 'fixed',
				...(coords.top !== undefined ? { top: `${coords.top}px` } : {}),
				...(coords.bottom !== undefined ? { bottom: `${coords.bottom}px` } : {}),
				left: `${coords.left}px`,
				minWidth: `${coords.width}px`,
				maxWidth: `${Math.max(coords.width, 360)}px`,
				maxHeight: `${coords.maxHeight}px`,
				overflowY: 'auto',
				overflowX: 'hidden',
				background: 'var(--menu-bg)',
				backdropFilter: 'var(--glass-blur-strong)',
				border: '1px solid var(--menu-border)',
				borderRadius: '8px',
				boxShadow: 'var(--menu-shadow)',
				padding: '4px',
				color: 'var(--text-primary)',
				fontSize: '13px',
				userSelect: 'none',
				zIndex: 2100000,
				animation: 'macosMenuFade 100ms cubic-bezier(0.16, 1, 0.3, 1)',
			}}
		>
			{items.map((item, idx) => {
				if (item.type === 'separator') {
					return (
						<div
							key={`sep-${idx}`}
							style={{
								height: '1px',
								background: 'var(--window-border)',
								margin: '4px 8px',
								opacity: 0.6,
							}}
						/>
					);
				}

				if (item.type === 'group') {
					return (
						<div
							key={`grp-${idx}`}
							style={{
								fontSize: '10.5px',
								fontWeight: 700,
								textTransform: 'uppercase',
								letterSpacing: '0.04em',
								opacity: 0.5,
								padding: '5px 8px 2px',
							}}
						>
							{item.label}
						</div>
					);
				}

				const isHovered = hoveredIndex === idx;

				return (
					<button
						key={`opt-${idx}-${item.value}`}
						type="button"
						data-select-idx={idx}
						disabled={item.disabled}
						onMouseEnter={() => {
							if (!item.disabled) setHoveredIndex(idx);
						}}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							if (item.disabled || item.value === undefined) return;
							setReactSelectValue(activeSelect, item.value, item.optionIndex);
							closeMenu();
						}}
						style={{
							width: '100%',
							display: 'flex',
							alignItems: 'center',
							gap: '7px',
							padding: '5px 8px',
							borderRadius: '5px',
							fontSize: '13px',
							fontWeight: item.selected ? 600 : 400,
							textAlign: 'left',
							cursor: item.disabled ? 'default' : 'pointer',
							lineHeight: 1.3,
							background: isHovered && !item.disabled ? 'var(--accent-blue)' : 'transparent',
							color: isHovered && !item.disabled ? '#ffffff' : 'inherit',
							opacity: item.disabled ? 0.4 : 1,
							pointerEvents: item.disabled ? 'none' : 'auto',
							transition: 'background 60ms ease, color 60ms ease',
						}}
					>
						<div
							style={{
								width: '16px',
								height: '16px',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								flexShrink: 0,
							}}
						>
							{item.selected && (
								<Check
									size={13}
									strokeWidth={2.5}
									color={isHovered ? '#ffffff' : 'var(--accent-blue)'}
								/>
							)}
						</div>

						<span
							style={{
								whiteSpace: 'nowrap',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								flex: 1,
							}}
						>
							{item.label}
						</span>
					</button>
				);
			})}
		</div>,
		document.body
	);
}
