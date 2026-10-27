'use client';

import React, { useMemo } from 'react';
import {
	Activity,
	Ban,
	ShieldCheck,
	Globe,
	ExternalLink,
	Terminal,
	FileSearch,
	Copy,
	Check,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { useWindowActions } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { MacOSMenu } from '@/components/Common/MacOSMenu';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';

export function SocContextMenu() {
	const {
		contextMenu,
		closeContextMenu,
		openInspector,
		setActiveTab,
		setSiemIp,
		setSiemIpOp,
		setSiemServis,
		setSiemServisOp,
		setSiemArama,
		setSiemAramaAlani,
		setSiemAramaOp,
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
		const { type, value } = contextMenu;

		const handleCopyValue = () => {
			copyToClipboard(value);
			setCopied(true);
			setTimeout(() => {
				setCopied(false);
				closeContextMenu();
			}, 600);
		};

		const headerItem: MenuItem = {
			id: 'soc-header',
			label: `${type.toUpperCase()}: ${value}`,
			header: true,
		};

		const copyItem: MenuItem = {
			id: 'soc-copy',
			label: copied ? t('dlgCopied') : t('ctxSocCopyVal'),
			icon: copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />,
			action: handleCopyValue,
		};

		const sep: MenuItem = { id: 'soc-sep-1', label: '', separator: true };

		const dynamicItems: MenuItem[] = [];

		if (type === 'ip') {
			dynamicItems.push(
				{
					id: 'soc-inspect-threat',
					label: t('ctxSocInspectThreat'),
					icon: <Activity size={13} />,
					action: () => {
						const banInfo = bans.find((b) => b.ip === value);
						const attackerInfo = overview?.topAttackers.find((a) => a.ip === value);
						openInspector({
							type: 'ip',
							data: {
								ip: value,
								banInfo,
								attackerInfo,
								threatIntel: banInfo?.threatIntel || attackerInfo?.threatIntel,
							},
						});
					},
				},
				{
					id: 'soc-filter-siem-ip',
					label: t('ctxSocFilterSiemIp'),
					icon: <Globe size={13} />,
					action: () => {
						setSiemIp(value);
						setSiemIpOp('eq');
						setActiveTab('siem');
					},
				}
			);

			if (canManage) {
				dynamicItems.push(
					{ id: 'soc-sep-danger', label: '', separator: true },
					{
						id: 'soc-quarantine-ip',
						label: t('ctxSocQuarantineIp'),
						icon: <Ban size={13} />,
						danger: true,
						action: () => {
							void handleQuickBan(value, 'Quick ban via right-click context menu');
						},
					}
				);
			}
		} else if (type === 'user') {
			dynamicItems.push(
				{
					id: 'soc-inspect-user',
					label: t('ctxSocInspectUser'),
					icon: <Activity size={13} />,
					action: () => {
						const session = sessions.find((s) => s.id === value);
						if (session) {
							openInspector({ type: 'session', data: session });
						} else {
							setSiemArama(value);
							setSiemAramaAlani('userId');
							setSiemAramaOp('equals');
							setActiveTab('siem');
						}
					},
				},
				{
					id: 'soc-jump-member',
					label: t('ctxSocJumpMember'),
					icon: <ExternalLink size={13} />,
					action: () => {
						openApp('members', { itemId: value });
					},
				},
				{
					id: 'soc-filter-user-siem',
					label: t('ctxSocFilterUserSiem'),
					icon: <FileSearch size={13} />,
					action: () => {
						setSiemArama(value);
						setSiemAramaAlani('userId');
						setSiemAramaOp('equals');
						setActiveTab('siem');
					},
				}
			);

			if (canManage) {
				dynamicItems.push(
					{ id: 'soc-sep-danger-user', label: '', separator: true },
					{
						id: 'soc-kill-terminals',
						label: t('ctxSocKillTerminals'),
						icon: <Terminal size={13} />,
						danger: true,
						action: () => {
							void handleKillUserTerminals(value);
						},
					}
				);
			}
		} else if (type === 'service') {
			dynamicItems.push(
				{
					id: 'soc-filter-service-siem',
					label: t('ctxSocFilterServiceSiem'),
					icon: <FileSearch size={13} />,
					action: () => {
						setSiemServis(value);
						setSiemServisOp('eq');
						setActiveTab('siem');
					},
				},
				{
					id: 'soc-inspect-fim',
					label: t('ctxSocInspectFim'),
					icon: <ShieldCheck size={13} />,
					action: () => {
						setActiveTab('inspection');
					},
				}
			);
		}

		return [headerItem, copyItem, sep, ...dynamicItems];
	}, [
		contextMenu,
		copied,
		t,
		closeContextMenu,
		bans,
		overview,
		openInspector,
		setSiemIp,
		setSiemIpOp,
		setActiveTab,
		canManage,
		handleQuickBan,
		sessions,
		setSiemArama,
		setSiemAramaAlani,
		setSiemAramaOp,
		openApp,
		handleKillUserTerminals,
		setSiemServis,
		setSiemServisOp,
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
