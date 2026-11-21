'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { ParsedSelectItem, SelectPopupCoords } from './selectDom';

interface SelectPopupListProps {
	menuRef: React.RefObject<HTMLDivElement | null>;
	coords: SelectPopupCoords;
	items: ParsedSelectItem[];
	hoveredIndex: number;
	onHover: (idx: number) => void;
	onSelect: (item: ParsedSelectItem) => void;
}

export function SelectPopupList({
	menuRef,
	coords,
	items,
	hoveredIndex,
	onHover,
	onSelect,
}: SelectPopupListProps) {
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
							if (!item.disabled) onHover(idx);
						}}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							if (!item.disabled && item.value !== undefined) {
								onSelect(item);
							}
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
