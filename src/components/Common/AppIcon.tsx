'use client';

import React from 'react';
import { AppID } from '@/types/workspace';
import { ALL_APPS_CONFIG } from '@/configs/apps.config';
import { LucideByName, appIconColor } from '@/core/apps/icons';

interface AppIconProps {
	appId: AppID;
	size?: number;
	color?: string;
	className?: string;
}

/** An app's own icon and tint, from its manifest; an unknown app gets the gear. */
export function AppIcon({ appId, size = 20, color, className }: AppIconProps) {
	return <LucideByName name={ALL_APPS_CONFIG[appId]?.icon ?? 'Settings'} size={size} color={color || appIconColor(appId)} className={className} />;
}
