'use client';

import React, { useMemo } from 'react';
import { useSoc } from '../../context/SocContext';
import { useWindowActions } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { MacOSMenu } from '@/components/Common/MacOSMenu';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import { buildSocMenuItems } from './buildSocMenuItems';

export function SocContextMenu() {
	const {
		contextMenu,
		closeContextMenu,
		openInspector,
		setActiveTab,
		setSiemIp,
		setSiemIpOp,
		setSiemService,
		setSiemServiceOp,
		setSiemSearch,
		setSiemSearchField,
		setSiemSearchOp,
		handleQuickBan,
		handleKillUserTerminals,
		bans,
		overview,
		sessions,
		canManage,
	} = useSoc();

	const { t } = useI18n();
	const { openApp } = useWindowActions();
	const [copied, setCopied] = React.useState(false);

	const items = useMemo<MenuItem[]>(() => {
		if (!contextMenu) return [];
		return buildSocMenuItems({
			contextMenu,
			copied,
			t,
			onCopyValue: () => {
				copyToClipboard(contextMenu.value);
				setCopied(true);
				setTimeout(() => {
					setCopied(false);
					closeContextMenu();
				}, 600);
			},
			bans,
			overview,
			sessions,
			canManage,
			openInspector,
			setActiveTab,
			setSiemIp,
			setSiemIpOp,
			setSiemService,
			setSiemServiceOp,
			setSiemSearch,
			setSiemSearchField,
			setSiemSearchOp,
			handleQuickBan,
			handleKillUserTerminals,
			openApp,
		});
	}, [
		contextMenu,
		copied,
		t,
		closeContextMenu,
		bans,
		overview,
		sessions,
		canManage,
		openInspector,
		setActiveTab,
		setSiemIp,
		setSiemIpOp,
		setSiemService,
		setSiemServiceOp,
		setSiemSearch,
		setSiemSearchField,
		setSiemSearchOp,
		handleQuickBan,
		handleKillUserTerminals,
		openApp,
	]);

	if (!contextMenu) return null;

	const { x, y } = contextMenu;
	const menuWidth = 240;
	const menuHeight = 280;
	const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
	const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

	const adjustedX = x + menuWidth > winWidth ? Math.max(10, winWidth - menuWidth - 10) : Math.max(10, x);
	const adjustedY = y + menuHeight > winHeight ? Math.max(30, winHeight - menuHeight - 10) : Math.max(30, y);

	return (
		<>
			<div
				style={{
					position: 'fixed',
					inset: 0,
					zIndex: 99998,
					background: 'transparent',
				}}
				onClick={closeContextMenu}
				onContextMenu={(e) => {
					e.preventDefault();
					closeContextMenu();
				}}
			/>
			<div
				style={{
					position: 'fixed',
					left: `${adjustedX}px`,
					top: `${adjustedY}px`,
					zIndex: 99999,
				}}
			>
				<MacOSMenu
					items={items}
					onClose={closeContextMenu}
					style={{ width: `${menuWidth}px`, minWidth: `${menuWidth}px` }}
				/>
			</div>
		</>
	);
}
