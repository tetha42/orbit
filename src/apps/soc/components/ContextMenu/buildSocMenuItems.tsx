import React from 'react';
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
import type { AppID, FocusTargetInput, MenuItem } from '@/types/workspace';
import type {
	ActiveSessionInfo,
	ContextMenuState,
	InspectorEntity,
	SecurityBlock,
	SiemSearchField,
	SiemSearchOp,
	SocOverviewData,
	SocTab,
} from '../../types';

export interface BuildSocMenuItemsParams {
	contextMenu: ContextMenuState;
	copied: boolean;
	t: (key: string) => string;
	onCopyValue: () => void;
	bans: SecurityBlock[];
	overview: SocOverviewData | null;
	sessions: ActiveSessionInfo[];
	canManage: boolean;
	openInspector: (entity: InspectorEntity) => void;
	setActiveTab: (tab: SocTab) => void;
	setSiemIp: (ip: string) => void;
	setSiemIpOp: (op: 'eq' | 'neq' | 'contains' | 'not_contains') => void;
	setSiemService: (service: string) => void;
	setSiemServiceOp: (op: 'eq' | 'neq') => void;
	setSiemSearch: (search: string) => void;
	setSiemSearchField: (field: SiemSearchField) => void;
	setSiemSearchOp: (op: SiemSearchOp) => void;
	handleQuickBan: (ip: string, reason: string) => Promise<void> | void;
	handleKillUserTerminals: (userId: string) => Promise<boolean> | Promise<void> | void;
	openApp: (id: AppID, target?: FocusTargetInput) => void;
}

export function buildSocMenuItems({
	contextMenu,
	copied,
	t,
	onCopyValue,
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
}: BuildSocMenuItemsParams): MenuItem[] {
	const { type, value } = contextMenu;

	const headerItem: MenuItem = {
		id: 'soc-header',
		label: `${type.toUpperCase()}: ${value}`,
		header: true,
	};

	const copyItem: MenuItem = {
		id: 'soc-copy',
		label: copied ? t('dlgCopied') : t('ctxSocCopyVal'),
		icon: copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />,
		action: onCopyValue,
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
						setSiemSearch(value);
						setSiemSearchField('userId');
						setSiemSearchOp('equals');
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
					setSiemSearch(value);
					setSiemSearchField('userId');
					setSiemSearchOp('equals');
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
					setSiemService(value);
					setSiemServiceOp('eq');
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
}
