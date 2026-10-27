'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MenuItem } from '@/types/workspace';
import { Check, ChevronRight } from 'lucide-react';

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

	// Clear timer on unmount
	useEffect(() => {
		return () => {
			if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
		};
	}, []);

	// Keyboard navigation within the active menu
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
				const nextItem = selectableItems[nextIndex];
				setHoveredItemId(nextItem.id);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				e.stopPropagation();
				const prevIndex = currentIndex <= 0 ? selectableItems.length - 1 : currentIndex - 1;
				const prevItem = selectableItems[prevIndex];
				setHoveredItemId(prevItem.id);
			} else if (e.key === 'ArrowRight') {
				const currentItem = selectableItems.find((it) => it.id === hoveredItemId);
				if (currentItem && currentItem.children && currentItem.children.length > 0) {
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
					if (currentItem.children && currentItem.children.length > 0) {
						setActiveSubmenuId((prev) => (prev === currentItem.id ? null : currentItem.id));
					} else {
						onClose();
						if (currentItem.action) {
							currentItem.action();
						}
					}
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [items, hoveredItemId, isSubmenu, onClose]);

	const handleItemMouseEnter = (item: MenuItem) => {
		if (item.disabled || item.separator || item.header) {
			if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
			setActiveSubmenuId(null);
			setHoveredItemId(null);
			return;
		}

		setHoveredItemId(item.id);

		if (item.children && item.children.length > 0) {
			if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
			submenuTimerRef.current = setTimeout(() => {
				// Measure collision with right and bottom edges of viewport
				const itemEl = itemRefs.current.get(item.id);
				if (itemEl && typeof window !== 'undefined') {
					const rect = itemEl.getBoundingClientRect();
					// Typical submenu width is 220px, height is approx 28px per item
					const estHeight = Math.min(300, (item.children?.length ?? 1) * 32 + 10);
					const fitsRight = rect.right + 220 <= window.innerWidth;
					const fitsBottom = rect.top + estHeight <= window.innerHeight;

					setSubmenuFlipLeft((prev) => ({ ...prev, [item.id]: !fitsRight }));
					setSubmenuFlipUp((prev) => ({ ...prev, [item.id]: !fitsBottom }));
				}
				setActiveSubmenuId(item.id);
			}, 90);
		} else {
			if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
			submenuTimerRef.current = setTimeout(() => {
				setActiveSubmenuId(null);
			}, 100);
		}
	};

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
			{items.map((item, idx) => {
				if (item.separator) {
					return (
						<div
							key={`sep-${item.id || idx}`}
							style={{
								height: '1px',
								background: 'var(--window-border)',
								margin: '4px 8px',
								opacity: 0.6,
							}}
						/>
					);
				}

				if (item.header) {
					return (
						<div
							key={`hdr-${item.id || idx}`}
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

				const isHovered = hoveredItemId === item.id;
				const hasChildren = Boolean(item.children && item.children.length > 0);
				const isSubmenuOpen = activeSubmenuId === item.id;
				const isDanger = Boolean(item.danger);

				const activeBg = isDanger ? 'var(--accent-red, #ff3b30)' : 'var(--accent-blue)';
				const activeColor = '#ffffff';

				return (
					<div
						key={item.id || idx}
						ref={(el) => {
							if (el) itemRefs.current.set(item.id, el);
							else itemRefs.current.delete(item.id);
						}}
						style={{ position: 'relative' }}
						onMouseEnter={() => handleItemMouseEnter(item)}
					>
						<button
							data-menu-item={item.id}
							disabled={item.disabled}
							role="menuitem"
							onClick={(e) => {
								e.stopPropagation();
								if (item.disabled) return;
								if (hasChildren) {
									setActiveSubmenuId(isSubmenuOpen ? null : item.id);
									return;
								}
								onClose();
								if (item.action) {
									item.action();
								}
							}}
							style={{
								width: '100%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '4px 8px',
								borderRadius: '5px',
								fontSize: '13px',
								fontWeight: 400,
								textAlign: 'left',
								cursor: 'default',
								lineHeight: 1.3,
								background: (isHovered || isSubmenuOpen) && !item.disabled ? activeBg : 'transparent',
								color: (isHovered || isSubmenuOpen) && !item.disabled ? activeColor : isDanger ? 'var(--accent-red, #ff3b30)' : 'inherit',
								opacity: item.disabled ? 0.4 : 1,
								pointerEvents: item.disabled ? 'none' : 'auto',
								transition: 'background 60ms ease, color 60ms ease',
							}}
						>
							{/* Left content: Checkmark / Icon / Label */}
							<div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1, overflow: 'hidden' }}>
								{hasAnyIconsOrChecks && (
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
										{item.checked ? (
											<Check size={13} strokeWidth={2.5} color={(isHovered || isSubmenuOpen) ? '#ffffff' : 'var(--accent-blue)'} />
										) : (
											item.icon || null
										)}
									</div>
								)}

								<span
									style={{
										whiteSpace: 'nowrap',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
									}}
								>
									{item.label}
								</span>
							</div>

							{/* Right content: Badge / Shortcut / Submenu arrow */}
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
								{item.badge && (
									<span
										style={{
											fontSize: '10px',
											fontWeight: 600,
											padding: '1px 5px',
											borderRadius: '6px',
											background: (isHovered || isSubmenuOpen) ? 'rgba(255,255,255,0.25)' : 'var(--fill-strong)',
											color: (isHovered || isSubmenuOpen) ? '#ffffff' : 'inherit',
										}}
									>
										{item.badge}
									</span>
								)}

								{item.shortcut && (
									<span
										style={{
											fontSize: '11.5px',
											opacity: (isHovered || isSubmenuOpen) ? 0.9 : 0.55,
											letterSpacing: '0.04em',
											fontWeight: 400,
										}}
									>
										{item.shortcut}
									</span>
								)}

								{hasChildren && (
									<ChevronRight
										size={13}
										style={{
											opacity: (isHovered || isSubmenuOpen) ? 1 : 0.6,
										}}
									/>
								)}
							</div>
						</button>

						{/* Cascading Submenu with bidirectional auto-flip */}
						{hasChildren && isSubmenuOpen && item.children && (
							<div
								style={{
									position: 'absolute',
									...(submenuFlipUp[item.id]
										? { bottom: '-4px' }
										: { top: '-4px' }),
									...(submenuFlipLeft[item.id]
										? { right: 'calc(100% - 2px)' }
										: { left: 'calc(100% - 2px)' }),
									zIndex: 100000,
								}}
							>
								<MacOSMenu
									items={item.children}
									onClose={onClose}
									isSubmenu={true}
								/>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
