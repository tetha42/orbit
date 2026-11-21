import type React from 'react';
import {
	Award,
	CalendarCheck,
	Cpu,
	DollarSign,
	FolderGit2,
	ListChecks,
	Mail,
	Newspaper,
	Users,
	type LucideIcon,
} from 'lucide-react';
import type { SearchKind } from '@/types/search';

export type StaticGroup = 'apps' | 'settings' | 'actions';
export type GroupId = StaticGroup | SearchKind;

export interface SpotlightRow {
	id: string;
	group: GroupId;
	title: string;
	subtitle?: string;
	badge: string;
	icon: React.ReactNode;
	score: number;
	stale?: boolean;
	run: () => void;
}

export interface SpotlightGroup {
	id: GroupId;
	rows: SpotlightRow[];
	best: number;
}

export const ICON_SIZE = 18;

export const KIND_ICONS: Record<SearchKind, { Icon: LucideIcon; color: string }> = {
	member: { Icon: Users, color: 'var(--success)' },
	team: { Icon: FolderGit2, color: 'var(--accent)' },
	task: { Icon: ListChecks, color: 'var(--indigo)' },
	event: { Icon: CalendarCheck, color: 'var(--danger)' },
	news: { Icon: Newspaper, color: 'var(--warning)' },
	item: { Icon: Cpu, color: 'var(--accent)' },
	certificate: { Icon: Award, color: 'var(--warning)' },
	ledger: { Icon: DollarSign, color: 'var(--success)' },
	message: { Icon: Mail, color: 'var(--accent)' },
};

export const GROUP_ORDER: GroupId[] = [
	'apps',
	'settings',
	'actions',
	'team',
	'task',
	'event',
	'news',
	'member',
	'item',
	'certificate',
	'ledger',
	'message',
];

export const GROUP_LABEL_KEYS: Record<GroupId, string> = {
	apps: 'spotlightSectionApps',
	settings: 'spotGroupSettings',
	actions: 'spotlightSectionActions',
	member: 'spotGroupMember',
	team: 'spotGroupTeam',
	task: 'spotGroupTask',
	event: 'spotGroupEvent',
	news: 'spotGroupNews',
	item: 'spotGroupItem',
	certificate: 'spotGroupCertificate',
	ledger: 'spotGroupLedger',
	message: 'spotGroupMessage',
};

export const BADGE_KEYS: Record<GroupId, string> = {
	apps: 'spotKindApp',
	settings: 'spotKindSetting',
	actions: 'spotKindAction',
	member: 'spotKindMember',
	team: 'spotKindTeam',
	task: 'spotKindTask',
	event: 'spotKindEvent',
	news: 'spotKindNews',
	item: 'spotKindItem',
	certificate: 'spotKindCertificate',
	ledger: 'spotKindLedger',
	message: 'spotKindMessage',
};

export const GROUP_CAP = 5;

export const hintKeyStyle: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 4,
	padding: '1px 5px',
	borderRadius: 4,
	background: 'var(--fill-strong)',
	fontSize: 10.5,
	fontWeight: 600,
};
