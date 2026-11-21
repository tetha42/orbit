'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MenuItem } from '@/types/workspace';
import { MacOSMenuItemRow } from './macosMenu/MacOSMenuItemRow';

interface MacOSMenuProps {
	items: MenuItem[];
	onClose: () => void;
	style?: React.CSSProperties;
	className?: string;
	isSubmenu?: boolean;
}

export function MacOSMenu({ items, onClose, style, className, isSubmenu = false }: MacOSMenuProps) {
	const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
	const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
	const [submenuFlipLeft, setSubmenuFlipLeft] = useState<Record<string, boolean>>({});
	const [submenuFlipUp, setSubmenuFlipUp] = useState<Record<string, boolean>>({});
	const submenuTimerRef = useRef<NodeJS.Timeout | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	useEffect(() => {
		return () => {
			if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
		};
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				onClose();
				return;
			}

			const selectableItems = items.filter((it) => !it.separator && !it.header && !it.disabled);
			if (selectableItems.length === 0) return;

			const currentIndex = selectableItems.findIndex((it) => it.id === hoveredItemId);

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				e.stopPropagation();
				const nextIndex = currentIndex < 0 || currentIndex === selectableItems.length - 1 ? 0 : currentIndex + 1;
				setHoveredItemId(selectableItems[nextIndex].id);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				e.stopPropagation();
				const prevIndex = currentIndex <= 0 ? selectableItems.length - 1 : currentIndex - 1;
				setHoveredItemId(selectableItems[prevIndex].id);
			} else if (e.key === 'ArrowRight') {
				const currentItem = selectableItems.find((it) => it.id === hoveredItemId);
				if (currentItem?.children?.length) {
					e.preventDefault();
					e.stopPropagation();
					setActiveSubmenuId(currentItem.id);
				}
			} else if (e.key === 'ArrowLeft') {
				if (isSubmenu) {
					e.preventDefault();
					e.stopPropagation();
					onClose();
				}
			} else if (e.key === 'Enter') {
				const currentItem = selectableItems.find((it) => it.id === hoveredItemId);
				if (currentItem) {
					e.preventDefault();
					e.stopPropagation();
					if (currentItem.children?.length) {
						setActiveSubmenuId((prev) => (prev === currentItem.id ? null : currentItem.id));
					} else {
						onClose();
						if (currentItem.action) currentItem.action();
					}
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [items, hoveredItemId, isSubmenu, onClose]);

	const clearSubmenuTimer = () => {
		if (submenuTimerRef.current) {
			clearTimeout(submenuTimerRef.current);
			submenuTimerRef.current = null;
		}
	};

	const openSubmenuFor = (item: MenuItem) => {
		const itemEl = itemRefs.current.get(item.id);
		if (itemEl && typeof window !== 'undefined') {
			const rect = itemEl.getBoundingClientRect();
			const estHeight = Math.min(300, (item.children?.length ?? 1) * 32 + 10);
			const fitsRight = rect.right + 220 <= window.innerWidth;
			const fitsBottom = rect.top + estHeight <= window.innerHeight;

			setSubmenuFlipLeft((prev) => ({ ...prev, [item.id]: !fitsRight }));
			setSubmenuFlipUp((prev) => ({ ...prev, [item.id]: !fitsBottom }));
		}
		setActiveSubmenuId(item.id);
	};

	const handleItemMouseEnter = (item: MenuItem) => {
		if (item.disabled || item.separator || item.header) {
			clearSubmenuTimer();
			setActiveSubmenuId(null);
			setHoveredItemId(null);
			return;
		}

		setHoveredItemId(item.id);
		clearSubmenuTimer();

		if (item.children && item.children.length > 0) {
			submenuTimerRef.current = setTimeout(() => {
				openSubmenuFor(item);
			}, 90);
		} else {
			submenuTimerRef.current = setTimeout(() => {
				setActiveSubmenuId(null);
			}, 240);
		}
	};

	const setItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
		if (el) itemRefs.current.set(id, el);
		else itemRefs.current.delete(id);
	}, []);

	const hasAnyIconsOrChecks = items.some((it) => it.icon || it.checked !== undefined);

	return (
		<div
			ref={menuRef}
			className={className}
			data-menu
			role="menu"
			style={{
				minWidth: '200px',
				maxWidth: '320px',
				background: 'var(--menu-bg)',
				backdropFilter: 'var(--glass-blur-strong)',
				border: '1px solid var(--menu-border)',
				borderRadius: '8px',
				boxShadow: 'var(--menu-shadow)',
				padding: '4px',
				color: 'var(--text-primary)',
				fontSize: '13px',
				userSelect: 'none',
				zIndex: 99999,
				animation: isSubmenu ? 'macosSubmenuFade 100ms ease-out' : 'macosMenuFade 100ms cubic-bezier(0.16, 1, 0.3, 1)',
				...style,
			}}
			onClick={(e) => e.stopPropagation()}
		>
			{items.map((item, idx) => (
				<MacOSMenuItemRow
					key={item.separator ? `sep-${item.id || idx}` : item.header ? `hdr-${item.id || idx}` : item.id || idx}
					item={item}
					hasAnyIconsOrChecks={hasAnyIconsOrChecks}
					isHovered={hoveredItemId === item.id}
					isSubmenuOpen={activeSubmenuId === item.id}
					flipLeft={Boolean(submenuFlipLeft[item.id])}
					flipUp={Boolean(submenuFlipUp[item.id])}
					setItemRef={setItemRef}
					onMouseEnter={handleItemMouseEnter}
					onToggleSubmenu={(id) => {
						clearSubmenuTimer();
						const target = items.find((entry) => entry.id === id);
						if (target) openSubmenuFor(target);
					}}
					onClose={onClose}
					renderSubmenu={(children) => (
						<div onMouseEnter={clearSubmenuTimer}>
							<MacOSMenu items={children} onClose={onClose} isSubmenu={true} />
						</div>
					)}
				/>
			))}
		</div>
	);
}
