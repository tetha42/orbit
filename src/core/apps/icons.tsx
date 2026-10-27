'use client';

import type { ComponentType } from 'react';
import { Award, CalendarCheck, Cpu, DollarSign, FileCheck, FileText, FolderGit2, Mail, Newspaper, Settings, Terminal, Users, type LucideProps } from 'lucide-react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { appColor } from '@/apps';

/**
 * A manifest names its icon (`icon: 'FolderGit2'`); this renders it. The icons
 * the built-in apps use are bundled; any other lucide icon a new app names is
 * fetched when first shown, so adding an app never means editing this file.
 */
const BUNDLED: Record<string, ComponentType<LucideProps>> = { Award, CalendarCheck, Cpu, DollarSign, FileCheck, FileText, FolderGit2, Mail, Newspaper, Settings, Terminal, Users };

/** "FolderGit2" → "folder-git-2", the name lucide's dynamic loader expects. */
const kebab = (name: string) =>
	name
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/([a-zA-Z])(\d)/g, '$1-$2')
		.toLowerCase();

export function LucideByName({ name, ...props }: { name: string } & LucideProps) {
	const Icon = BUNDLED[name];
	if (Icon) return <Icon {...props} />;
	return <DynamicIcon name={kebab(name) as IconName} fallback={() => <Settings {...props} />} {...props} />;
}

/** The tint an app's icon has on its own (the manifest's `colors`, else its accent colour). */
export const appIconColor = (appId: string, where: 'icon' | 'menu' | 'search' = 'icon') => appColor(appId, where);
