'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, FormEvent, HTMLAttributes, ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { useSheet } from '@/lib/client/useSheet';
import { BASE_MODAL_Z } from '@/lib/client/modalLock';
import ui from './ui.module.css';

export type SheetTone = 'default' | 'info' | 'success' | 'warning' | 'danger';

const INTERACTIVE_SELECTOR = 'button, input, textarea, select, a, label, [role="button"]';

/**
 * Provides smooth pointer dragging for a modal / Zenity window header,
 * clamped to the desktop viewport (staying below the 28px TopBar).
 */
export function useDraggableSheet(enabled = true) {
	const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const [dragging, setDragging] = useState(false);
	const offsetRef = useRef(offset);
	useEffect(() => {
		offsetRef.current = offset;
	}, [offset]);

	const onHeaderMouseDown = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			if (!enabled || e.button !== 0) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest(INTERACTIVE_SELECTOR)) return;

			const startX = e.clientX;
			const startY = e.clientY;
			const origX = offsetRef.current.x;
			const origY = offsetRef.current.y;
			let active = false;

			const onMove = (move: MouseEvent) => {
				if (move.buttons === 0) {
					cleanup();
					return;
				}
				const dx = move.clientX - startX;
				const dy = move.clientY - startY;
				if (!active) {
					if (Math.hypot(dx, dy) < 3) return;
					active = true;
					setDragging(true);
					document.body.style.userSelect = 'none';
				}
				const maxX = Math.max(120, Math.floor(window.innerWidth * 0.42));
				const maxY = Math.max(80, Math.floor(window.innerHeight * 0.42));
				const clampedX = Math.max(-maxX, Math.min(maxX, origX + dx));
				const clampedY = Math.max(-maxY, Math.min(maxY, origY + dy));
				setOffset({ x: clampedX, y: clampedY });
			};

			const cleanup = () => {
				window.removeEventListener('mousemove', onMove);
				window.removeEventListener('mouseup', cleanup);
				if (active) {
					setDragging(false);
					document.body.style.userSelect = '';
				}
			};

			window.addEventListener('mousemove', onMove);
			window.addEventListener('mouseup', cleanup);
		},
		[enabled]
	);

	const onHeaderDoubleClick = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			if (!enabled) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest(INTERACTIVE_SELECTOR)) return;
			setOffset({ x: 0, y: 0 });
		},
		[enabled]
	);

	const resetOffset = useCallback(() => setOffset({ x: 0, y: 0 }), []);

	return {
		offset,
		dragging,
		onHeaderMouseDown,
		onHeaderDoubleClick,
		resetOffset,
	};
}

export interface ModalOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClose'> {
	onClose: () => void;
	pausedRef?: RefObject<boolean>;
	baseZ?: number;
	closeOnBackdrop?: boolean;
	children: ReactNode;
}

/**
 * Desktop-level portaled modal backdrop with LIFO z-index stack management and Escape handling.
 * Renders directly in `document.body` above all mini-app windows.
 */
export function ModalOverlay({
	onClose,
	pausedRef,
	baseZ = BASE_MODAL_Z,
	closeOnBackdrop = true,
	style,
	className,
	children,
	...rest
}: ModalOverlayProps) {
	const { zIndex, bringToFront } = useSheet(onClose, pausedRef, baseZ);

	const node = (
		<div
			{...rest}
			data-lenis-prevent
			data-lenis-prevent-wheel
			data-lenis-prevent-touch
			className={`${ui.overlay}${className ? ` ${className}` : ''}`}
			style={{ ...style, zIndex }}
			onMouseDownCapture={() => bringToFront()}
			onMouseDown={(e) => {
				if (closeOnBackdrop && e.target === e.currentTarget) {
					onClose();
				}
				rest.onMouseDown?.(e);
			}}
		>
			{children}
		</div>
	);

	if (typeof document === 'undefined') return node;
	return createPortal(node, document.body);
}

export interface SheetProps {
	/** Shown in the title row and used as the dialog's accessible name. */
	title?: ReactNode;
	/** Optional subtitle line rendered under the title (Zenity context/team name). */
	subtitle?: ReactNode;
	/** Accessible name when `title` is not plain text. */
	label?: string;
	icon?: ReactNode;
	/** Replaces the title text (e.g. a code badge above the name). */
	header?: ReactNode;
	/** Optional sticky footer bar (buttons stay pinned while the body scrolls). */
	footer?: ReactNode;
	onClose: () => void;
	onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
	/** Zenity `--width` parameter. */
	width?: number | string;
	/** Zenity `--height` parameter. */
	height?: number | string;
	maxWidth?: number | string;
	/** The wide sheet (detail views) instead of the small one (forms). */
	wide?: boolean;
	/** Zenity dialog tone accent (`info`, `success`, `warning`, `danger`). */
	tone?: SheetTone;
	/** Allows dragging the modal window by its titlebar (default: true). */
	draggable?: boolean;
	/** True while a dialog on top of the sheet owns Escape. */
	pausedRef?: RefObject<boolean>;
	/** Base z-index tier override. */
	zIndex?: number;
	closeOnBackdrop?: boolean;
	closeLabel?: string;
	bodyStyle?: CSSProperties;
	bodyClassName?: string;
	/** Extra attributes forwarded to the `<form>` or `<div role="dialog">` container. */
	dialogProps?: Record<string, unknown>;
	children: ReactNode;
}

/**
 * The Zenity-style modal window every app uses: portaled to `document.body` above
 * all mini-app windows, managed by the LIFO z-index stack, draggable by its titlebar,
 * with scrollable body, optional sticky footer, Escape to close, and workspace modal lock.
 */
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
	closeLabel = 'Kapat',
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

export const ZenityWindow = Sheet;
