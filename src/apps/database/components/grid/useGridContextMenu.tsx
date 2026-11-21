'use client';

import React, { useEffect, useRef } from 'react';
import { Trash2, Eye, Copy, Filter } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import { useShellActions } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import type { ColumnSpec, FilterRule } from '../../types';

interface UseGridContextMenuOptions {
	onDeleteRows: (rowPks: unknown[]) => void;
	onAddFilter: (initial?: Partial<FilterRule>) => void;
	onOpenRowDrawer?: (row: Record<string, unknown>) => void;
}

export function useGridContextMenu({
	onDeleteRows,
	onAddFilter,
	onOpenRowDrawer,
}: UseGridContextMenuOptions) {
	const { t } = useI18n();
	const dialog = useDialog();
	const { openContextMenu } = useShellActions();
	const rowTouchTimerRef = useRef<{
		timer: ReturnType<typeof setTimeout> | null;
		startX: number;
		startY: number;
	} | null>(null);

	useEffect(() => {
		return () => {
			if (rowTouchTimerRef.current?.timer) {
				clearTimeout(rowTouchTimerRef.current.timer);
			}
		};
	}, []);

	const appendRowActions = (items: MenuItem[], row: Record<string, unknown>, pkVal: unknown) => {
		if (onOpenRowDrawer) {
			items.push({
				id: `inspect-${String(pkVal)}`,
				label: t('ctxDbInspect'),
				icon: <Eye size={13} />,
				action: () => onOpenRowDrawer(row),
			});
		}
		items.push(
			{ id: `sep-db-${String(pkVal)}`, label: '', separator: true },
			{
				id: `delete-row-${String(pkVal)}`,
				label: t('ctxDbDeleteRow'),
				icon: <Trash2 size={13} />,
				danger: true,
				action: async () => {
					const confirmed = await dialog.confirm({
						title: t('ctxDbDeleteRow'),
						message: fill(t('dbDeleteRowsConfirm'), { n: 1 }),
						tone: 'danger',
					});
					if (confirmed) {
						onDeleteRows([pkVal]);
					}
				},
			}
		);
	};

	const triggerRowMenu = (x: number, y: number, row: Record<string, unknown>, pkVal: unknown) => {
		const items: MenuItem[] = [
			{
				id: `copy-json-${String(pkVal)}`,
				label: t('ctxDbCopyJson'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(JSON.stringify(row, null, 2));
				},
			},
		];
		appendRowActions(items, row, pkVal);
		openContextMenu({ x, y, mode: 'app', customItems: items });
	};

	const triggerCellMenu = (
		x: number,
		y: number,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => {
		const strVal =
			displayVal === null || displayVal === undefined
				? ''
				: typeof displayVal === 'object'
					? JSON.stringify(displayVal)
					: String(displayVal);

		const items: MenuItem[] = [
			{
				id: `copy-cell-${String(pkVal)}-${col.name}`,
				label: t('ctxDbCopyCell'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(strVal);
				},
			},
			{
				id: `filter-cell-${String(pkVal)}-${col.name}`,
				label: t('ctxDbFilterByCell'),
				icon: <Filter size={13} />,
				action: () => {
					onAddFilter({ column: col.name, op: '=', value: strVal });
				},
			},
			{ id: `sep-cell-${String(pkVal)}-${col.name}`, label: '', separator: true },
			{
				id: `copy-json-${String(pkVal)}`,
				label: t('ctxDbCopyJson'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(JSON.stringify(row, null, 2));
				},
			},
		];
		appendRowActions(items, row, pkVal);
		openContextMenu({ x, y, mode: 'app', customItems: items });
	};

	const clearTouchTimer = () => {
		if (rowTouchTimerRef.current?.timer) {
			clearTimeout(rowTouchTimerRef.current.timer);
		}
		rowTouchTimerRef.current = null;
	};

	const vibrateFeedback = () => {
		try {
			if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
				navigator.vibrate(20);
			}
		} catch {
			// Ignore unsupported vibration errors
		}
	};

	const handleRowContextMenu = (e: React.MouseEvent, row: Record<string, unknown>, pkVal: unknown) => {
		e.preventDefault();
		e.stopPropagation();
		triggerRowMenu(e.clientX, e.clientY, row, pkVal);
	};

	const handleCellContextMenu = (
		e: React.MouseEvent,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => {
		e.preventDefault();
		e.stopPropagation();
		triggerCellMenu(e.clientX, e.clientY, row, col, pkVal, displayVal);
	};

	const handleTouchStartRow = (e: React.TouchEvent, row: Record<string, unknown>, pkVal: unknown) => {
		if (e.touches.length !== 1) return;
		clearTouchTimer();
		const { clientX, clientY } = e.touches[0];
		rowTouchTimerRef.current = {
			startX: clientX,
			startY: clientY,
			timer: setTimeout(() => {
				vibrateFeedback();
				triggerRowMenu(clientX, clientY, row, pkVal);
			}, 500),
		};
	};

	const handleTouchMoveRow = (e: React.TouchEvent) => {
		if (!rowTouchTimerRef.current?.timer || e.touches.length !== 1) return;
		const touch = e.touches[0];
		const dx = Math.abs(touch.clientX - rowTouchTimerRef.current.startX);
		const dy = Math.abs(touch.clientY - rowTouchTimerRef.current.startY);
		if (dx > 10 || dy > 10) {
			clearTouchTimer();
		}
	};

	const handleTouchStartCell = (
		e: React.TouchEvent,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => {
		if (e.touches.length !== 1) return;
		e.stopPropagation();
		// Cancel row-level timer so cell menu takes precedence on cell tap
		clearTouchTimer();
		const { clientX, clientY } = e.touches[0];
		rowTouchTimerRef.current = {
			startX: clientX,
			startY: clientY,
			timer: setTimeout(() => {
				vibrateFeedback();
				triggerCellMenu(clientX, clientY, row, col, pkVal, displayVal);
			}, 500),
		};
	};

	return {
		handleRowContextMenu,
		handleCellContextMenu,
		handleTouchStartRow,
		handleTouchEndRow: clearTouchTimer,
		handleTouchMoveRow,
		handleTouchStartCell,
	};
}
