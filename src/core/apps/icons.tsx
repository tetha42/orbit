'use client';

import type { ComponentType } from 'react';
import {
	Award,
	CalendarCheck,
	Cpu,
	Database,
	DollarSign,
	FileCheck,
	FileText,
	FolderGit2,
	Image as LucideImage,
	Landmark,
	Mail,
	MessageSquare,
	Newspaper,
	Settings,
	ShieldAlert,
	Terminal,
	Users,
	type LucideProps,
} from 'lucide-react';
import { appColor } from '@/apps';

/**
 * A manifest names its icon (`icon: 'FolderGit2'`); this renders it. All built-in
 * app icons are bundled directly to avoid runtime dynamic icon chunk fetches.
 */
const BUNDLED: Record<string, ComponentType<LucideProps>> = {
	Award,
	CalendarCheck,
	Cpu,
	Database,
	DollarSign,
	FileCheck,
	FileText,
	FolderGit2,
	Image: LucideImage,
	Landmark,
	Mail,
	MessageSquare,
	Newspaper,
	Settings,
	ShieldAlert,
	Terminal,
	Users,
};

export function LucideByName({ name, ...props }: { name: string } & LucideProps) {
	const Icon = BUNDLED[name] ?? Settings;
	return <Icon {...props} />;
}

/** The tint an app's icon has on its own (the manifest's `colors`, else its accent colour). */
export const appIconColor = (appId: string, where: 'icon' | 'menu' | 'search' = 'icon') => appColor(appId, where);
