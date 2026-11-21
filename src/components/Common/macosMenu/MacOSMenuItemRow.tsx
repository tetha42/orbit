'use client';

import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { MenuItem } from '@/types/workspace';

interface MacOSMenuItemRowProps {
	item: MenuItem;
	hasAnyIconsOrChecks: boolean;
	isHovered: boolean;
	isSubmenuOpen: boolean;
	flipLeft: boolean;
	flipUp: boolean;
	setItemRef: (id: string, el: HTMLDivElement | null) => void;
	onMouseEnter: (item: MenuItem) => void;
	onToggleSubmenu: (id: string) => void;
	onClose: () => void;
	renderSubmenu: (children: MenuItem[]) => React.ReactNode;
}

export function MacOSMenuItemRow({
	item,
	hasAnyIconsOrChecks,
	isHovered,
	isSubmenuOpen,
	flipLeft,
	flipUp,
	setItemRef,
	onMouseEnter,
	onToggleSubmenu,
	onClose,
	renderSubmenu,
}: MacOSMenuItemRowProps) {
	if (item.separator) {
		return (
			<div
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

	const hasChildren = Boolean(item.children && item.children.length > 0);
	const isDanger = Boolean(item.danger);
	const activeBg = isDanger ? 'var(--accent-red, var(--danger))' : 'var(--accent-blue)';
	const activeColor = '#ffffff';
	const highlighted = (isHovered || isSubmenuOpen) && !item.disabled;

	return (
		<div
			ref={(el) => setItemRef(item.id, el)}
			style={{ position: 'relative' }}
			onMouseEnter={() => onMouseEnter(item)}
		>
			<button
				data-menu-item={item.id}
				disabled={item.disabled}
				role="menuitem"
				onClick={(e) => {
					e.stopPropagation();
					if (item.disabled) return;
					if (hasChildren) {
						onToggleSubmenu(item.id);
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
					background: highlighted ? activeBg : 'transparent',
					color: highlighted ? activeColor : isDanger ? 'var(--accent-red, var(--danger))' : 'inherit',
					opacity: item.disabled ? 0.4 : 1,
					pointerEvents: item.disabled ? 'none' : 'auto',
					transition: 'background 60ms ease, color 60ms ease',
				}}
			>
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
								<Check
									size={13}
									strokeWidth={2.5}
									color={isHovered || isSubmenuOpen ? '#ffffff' : 'var(--accent-blue)'}
								/>
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

				<div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
					{item.badge && (
						<span
							style={{
								fontSize: '10px',
								fontWeight: 600,
								padding: '1px 5px',
								borderRadius: '6px',
								background: isHovered || isSubmenuOpen ? 'rgba(255,255,255,0.25)' : 'var(--fill-strong)',
								color: isHovered || isSubmenuOpen ? '#ffffff' : 'inherit',
							}}
						>
							{item.badge}
						</span>
					)}

					{item.shortcut && (
						<span
							style={{
								fontSize: '11.5px',
								opacity: isHovered || isSubmenuOpen ? 0.9 : 0.55,
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
								opacity: isHovered || isSubmenuOpen ? 1 : 0.6,
							}}
						/>
					)}
				</div>
			</button>

			{hasChildren && isSubmenuOpen && item.children && (
				<div
					style={{
						position: 'absolute',
						...(flipUp ? { bottom: '-4px' } : { top: '-4px' }),
						...(flipLeft ? { right: 'calc(100% - 2px)' } : { left: 'calc(100% - 2px)' }),
						zIndex: 100000,
					}}
				>
					{renderSubmenu(item.children)}
				</div>
			)}
		</div>
	);
}
