'use client';

import React from 'react';
import type { CSSProperties, FormEvent, ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { BASE_MODAL_Z } from '@/lib/client/modalLock';
import ui from './ui.module.css';
import { useDraggableSheet } from './sheet/useDraggableSheet';
import { ModalOverlay, type ModalOverlayProps } from './sheet/ModalOverlay';

export { useDraggableSheet, ModalOverlay };
export type { ModalOverlayProps };

export type SheetTone = 'default' | 'info' | 'success' | 'warning' | 'danger';

export interface SheetProps {
	title?: ReactNode;
	subtitle?: ReactNode;
	label?: string;
	icon?: ReactNode;
	header?: ReactNode;
	footer?: ReactNode;
	onClose: () => void;
	onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
	width?: number | string;
	height?: number | string;
	maxWidth?: number | string;
	wide?: boolean;
	tone?: SheetTone;
	draggable?: boolean;
	pausedRef?: RefObject<boolean>;
	zIndex?: number;
	closeOnBackdrop?: boolean;
	closeLabel?: string;
	bodyStyle?: CSSProperties;
	bodyClassName?: string;
	dialogProps?: Record<string, unknown>;
	children: ReactNode;
}

/** Portaled Zenity-style modal window with LIFO z-index stack, draggable header, and workspace modal lock. */
export function Sheet({
	title,
	subtitle,
	label,
	icon,
	header,
	footer,
	onClose,
	onSubmit,
	width,
	height,
	maxWidth,
	wide = false,
	tone = 'default',
	draggable = true,
	pausedRef,
	zIndex = BASE_MODAL_Z,
	closeOnBackdrop = true,
	closeLabel = 'Close',
	bodyStyle,
	bodyClassName,
	dialogProps,
	children,
}: SheetProps) {
	const { offset, dragging, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(draggable);

	const toneClass = tone !== 'default' ? ui[`sheetTone_${tone}` as keyof typeof ui] : '';
	const sheetStyle: CSSProperties = {
		...(width !== undefined ? { width } : {}),
		...(height !== undefined ? { height } : {}),
		...(maxWidth !== undefined ? { maxWidth } : {}),
		...(offset.x !== 0 || offset.y !== 0 ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` } : {}),
	};

	const props = {
		...dialogProps,
		className: `${ui.sheet} ${wide ? '' : ui.sheetSmall}${toneClass ? ` ${toneClass}` : ''}`,
		style: Object.keys(sheetStyle).length > 0 ? sheetStyle : undefined,
		role: 'dialog',
		'aria-modal': true,
		'aria-label': label ?? (typeof title === 'string' ? title : undefined),
	};

	const headerClass = `${ui.sheetHeader}${draggable ? ` ${ui.sheetHeaderDraggable}` : ''}${dragging ? ` ${ui.sheetHeaderDragging}` : ''}`;

	const inner = (
		<>
			<div className={headerClass} onMouseDown={onHeaderMouseDown} onDoubleClick={onHeaderDoubleClick}>
				{icon}
				{header ?? (
					<div className={ui.sheetTitleGroup}>
						<h3 className={ui.sheetTitle}>{title}</h3>
						{subtitle && <div className={ui.sheetSubtitle}>{subtitle}</div>}
					</div>
				)}
				<div className={ui.sheetControls}>
					<button type="button" className={ui.iconBtn} onClick={onClose} aria-label={closeLabel}>
						<X size={16} />
					</button>
				</div>
			</div>
			<div className={`${ui.sheetMain}${bodyClassName ? ` ${bodyClassName}` : ''}`} style={bodyStyle}>
				{children}
			</div>
			{footer && <div className={ui.sheetFooter}>{footer}</div>}
		</>
	);

	return (
		<ModalOverlay onClose={onClose} pausedRef={pausedRef} baseZ={zIndex} closeOnBackdrop={closeOnBackdrop}>
			{onSubmit ? (
				<form {...props} onSubmit={onSubmit}>
					{inner}
				</form>
			) : (
				<div {...props}>{inner}</div>
			)}
		</ModalOverlay>
	);
}
