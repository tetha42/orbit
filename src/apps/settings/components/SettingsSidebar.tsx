'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { SettingsTabId } from '@/configs/settings.config';
import type { SettingsSection } from '../types';
import {
	Building2,
	Database,
	Globe,
	Image as ImageIcon,
	KeyRound,
	Layout,
	Mail,
	Network,
	ShieldCheck,
	Sparkles,
	UserRound,
	type LucideIcon,
} from 'lucide-react';

const TAB_ICONS: Record<SettingsTabId, LucideIcon> = {
	account: UserRound,
	wallpaper: ImageIcon,
	dock: Layout,
	appearance: Sparkles,
	storage: Database,
	language: Globe,
	security: ShieldCheck,
	community: Building2,
	roles: KeyRound,
	smtp: Mail,
	integrations: Network,
};

interface SettingsSidebarProps {
	visibleSections: SettingsSection[];
	activeTab: SettingsTabId;
	onSelectTab: (id: SettingsTabId) => void;
}

export function SettingsSidebar({ visibleSections, activeTab, onSelectTab }: SettingsSidebarProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				width: '190px',
				height: '100%',
				background: 'var(--settings-sidebar-bg)',
				borderRight: '1px solid var(--border-subtle)',
				padding: '12px 8px',
				display: 'flex',
				flexDirection: 'column',
				gap: '2px',
				flexShrink: 0,
				userSelect: 'none',
				position: 'static',
				overflowY: 'hidden',
			}}
		>
			{(['kisisel', 'hesap', 'sistem'] as const).map((group) => {
				const tabs = visibleSections.filter((sec) => sec.group === group);
				if (!tabs.length) return null;
				return (
					<div key={group} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
						{group === 'kisisel' ? (
							<div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, padding: '4px 8px', textTransform: 'uppercase' }}>
								{t('settingsGroupPersonal')}
							</div>
						) : (
							<>
								<div style={{ height: '1px', background: 'var(--window-border)', margin: '6px 8px' }} />
								{group === 'sistem' && (
									<div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5, padding: '4px 8px', textTransform: 'uppercase' }}>
										{t('settingsGroupSystem')}
									</div>
								)}
							</>
						)}
						{tabs.map((sec) => {
							const Icon = TAB_ICONS[sec.id];
							const active = activeTab === sec.id;
							return (
								<button
									key={sec.id}
									data-settings-tab={sec.id}
									onClick={() => onSelectTab(sec.id)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '8px',
										padding: '6px 10px',
										borderRadius: '6px',
										fontSize: '13px',
										fontWeight: active ? 600 : 400,
										background: active ? 'var(--accent)' : 'transparent',
										color: active ? '#fff' : 'inherit',
										cursor: 'default',
										textAlign: 'left',
										border: 'none',
									}}
								>
									<Icon size={15} />
									<span>{t(sec.labelKey)}</span>
								</button>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
