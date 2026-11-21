'use client';

import React from 'react';
import {
	Radar,
	Flame,
	Users,
	FileSearch,
	History,
	ShieldCheck,
	KeyRound,
	Cpu,
	Activity,
	Eye,
} from 'lucide-react';
import { SOC_LAB_TABS, type SocTab, type TestbenchTab } from '../../types';
import s from './SocSidebar.module.css';
import type { SidebarCopy } from './i18nSidebar';

interface NavEntry {
	id: SocTab;
	label: string;
	shortcut: string;
	icon: React.ReactNode;
	badgeCount?: number;
	visible?: boolean;
	isLab?: boolean;
}

interface SidebarNavGroupsProps {
	copy: SidebarCopy;
	activeTab: SocTab;
	canManage: boolean;
	activeBansCount: number;
	sessionsCount: number;
	siemLogsCount: number;
	onSelectTab: (tab: SocTab) => void;
	onOpenLabTab: (tab: TestbenchTab) => void;
}

export function SidebarNavGroups({
	copy,
	activeTab,
	canManage,
	activeBansCount,
	sessionsCount,
	siemLogsCount,
	onSelectTab,
	onOpenLabTab,
}: SidebarNavGroupsProps) {
	const groups: Array<{ title: string; items: NavEntry[] }> = [
		{
			title: copy.groupOperations,
			items: [
				{ id: 'radar', label: copy.navRadar, shortcut: '⌥1', icon: <Radar size={14} /> },
				{
					id: 'firewall',
					label: copy.navFirewall,
					shortcut: '⌥2',
					icon: <Flame size={14} />,
					badgeCount: activeBansCount,
				},
				{
					id: 'sessions',
					label: copy.navSessions,
					shortcut: '⌥3',
					icon: <Users size={14} />,
					badgeCount: sessionsCount,
				},
			],
		},
		{
			title: copy.groupForensics,
			items: [
				{
					id: 'siem',
					label: copy.navSiem,
					shortcut: '⌥4',
					icon: <FileSearch size={14} />,
					badgeCount: siemLogsCount,
				},
				{ id: 'inspection', label: copy.navInspection, shortcut: '⌥5', icon: <ShieldCheck size={14} /> },
				{ id: 'audit', label: copy.navAudit, shortcut: '⌥A', icon: <History size={14} />, visible: canManage },
			],
		},
		{
			title: copy.groupLab,
			items: [
				{
					id: 'fuzzer',
					label: copy.navFuzzer,
					shortcut: '⌥6',
					icon: <Flame size={14} style={{ color: 'var(--warning)' }} />,
					isLab: true,
				},
				{
					id: 'oauth',
					label: copy.navOAuth,
					shortcut: '⌥7',
					icon: <KeyRound size={14} />,
					visible: canManage || SOC_LAB_TABS.includes('oauth'),
					isLab: true,
				},
				{ id: 'api', label: copy.navApi, shortcut: '⌥8', icon: <Cpu size={14} />, isLab: true },
				{
					id: 'health',
					label: copy.navHealth,
					shortcut: '⌥9',
					icon: <Activity size={14} />,
					visible: canManage || SOC_LAB_TABS.includes('health'),
					isLab: true,
				},
				{ id: 'session', label: copy.navSessionInspector, shortcut: '⌥9', icon: <Eye size={14} />, isLab: true },
			],
		},
	];

	return (
		<div className={s.scrollArea}>
			{groups.map((group) => (
				<div key={group.title} className={s.group}>
					<div className={s.groupTitle}>{group.title}</div>
					{group.items
						.filter((item) => item.visible !== false)
						.map((item) => (
							<button
								key={item.id}
								type="button"
								className={`${s.navItem} ${activeTab === item.id ? s.navItemActive : ''}`}
								onClick={() =>
									item.isLab
										? onOpenLabTab(item.id as TestbenchTab)
										: onSelectTab(item.id)
								}
							>
								<div className={s.navItemLeft}>
									<span className={s.navIcon}>{item.icon}</span>
									<span className={s.navLabel}>{item.label}</span>
								</div>
								<div className={s.navItemRight}>
									{typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
										<span className={s.countBadge}>{item.badgeCount}</span>
									)}
									<span className={s.shortcut}>{item.shortcut}</span>
								</div>
							</button>
						))}
				</div>
			))}
		</div>
	);
}
