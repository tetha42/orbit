'use client';

import React from 'react';
import { AppID } from '@/types/workspace';
import { APPS_CONFIG } from '@/configs/apps.config';
import { AppIcon } from '@/components/Common/AppIcon';
import { EventsAppIcon, TeamsAppIcon } from './appIcons/OrgAppIcons';
import { BudgetAppIcon, CertificatesAppIcon } from './appIcons/FinanceAndCertIcons';
import { InventoryAppIcon, MembersAppIcon } from './appIcons/HardwareAndMemberIcons';
import { NotesAppIcon, SettingsAppIcon } from './appIcons/WorkspaceToolIcons';
import { DatabaseAppIcon, ProjectsAppIcon, TerminalAppIcon } from './appIcons/DevAppIcons';
import { ChatAppIcon, NewsAppIcon } from './appIcons/CommAppIcons';

interface ModernAppIconProps {
	appId: AppID;
	size?: number;
	className?: string;
	showShadow?: boolean;
}

export function ModernAppIcon({ appId, size = 48, className, showShadow = true }: ModernAppIconProps) {
	const shadowStyle = showShadow
		? {
				filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
			}
		: {};
	const iconProps = { size, className, shadowStyle };

	switch (appId) {
		case 'teams':
			return <TeamsAppIcon {...iconProps} />;
		case 'events':
			return <EventsAppIcon {...iconProps} />;
		case 'budget':
			return <BudgetAppIcon {...iconProps} />;
		case 'certificates':
			return <CertificatesAppIcon {...iconProps} />;
		case 'inventory':
			return <InventoryAppIcon {...iconProps} />;
		case 'members':
			return <MembersAppIcon {...iconProps} />;
		case 'notes':
			return <NotesAppIcon {...iconProps} />;
		case 'settings':
			return <SettingsAppIcon {...iconProps} />;
		case 'terminal':
			return <TerminalAppIcon {...iconProps} />;
		case 'database':
			return <DatabaseAppIcon {...iconProps} />;
		case 'projects':
			return <ProjectsAppIcon {...iconProps} />;
		case 'chat':
			return <ChatAppIcon {...iconProps} />;
		case 'news':
			return <NewsAppIcon {...iconProps} />;
		default: {
			// An app without a hand-drawn icon: its manifest's icon on an accent tile.
			// Every current app has one, so `appId` narrows to `never` here; widen it for apps added later.
			const accent = APPS_CONFIG[appId as AppID]?.accentColor ?? 'var(--neutral)';
			return (
				<div
					className={className}
					style={{
						width: size,
						height: size,
						borderRadius: '22.5%',
						background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 86%, transparent))`,
						display: 'grid',
						placeItems: 'center',
						...shadowStyle,
					}}
				>
					<AppIcon appId={appId} size={Math.round(size * 0.5)} color="var(--accent-contrast)" />
				</div>
			);
		}
	}
}
