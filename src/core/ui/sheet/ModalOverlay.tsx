'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import type { HTMLAttributes, ReactNode, RefObject } from 'react';
import { useSheet } from '@/lib/client/useSheet';
import { BASE_MODAL_Z } from '@/lib/client/modalLock';
import ui from '../ui.module.css';

export interface ModalOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClose'> {
	onClose: () => void;
	pausedRef?: RefObject<boolean>;
	baseZ?: number;
	closeOnBackdrop?: boolean;
	children: ReactNode;
}

/** Desktop-level portaled modal backdrop with LIFO z-index stack management and Escape handling. */
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
