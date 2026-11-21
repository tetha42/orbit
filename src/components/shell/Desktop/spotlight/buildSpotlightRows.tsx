import React from 'react';
import {
	Keyboard,
	LifeBuoy,
	LogOut,
	Moon,
	Radio,
	SlidersHorizontal,
	Sun,
	Volume2,
	VolumeX,
} from 'lucide-react';
import { APPS_CONFIG } from '@/configs/apps.config';
import { SETTINGS_SECTIONS } from '@/configs/settings.config';
import { LucideByName, appIconColor } from '@/core/apps/icons';
import { getNextLocale } from '@/core/i18n';
import { fill, scoreMatch, type SearchField } from '@/lib/text';
import type { SearchHit } from '@/types/search';
import type { AppID, FocusTargetInput } from '@/types/workspace';
import type { ExtendedAppMetadata } from '@/configs/apps.config';
import type { Language } from '@/lib/i18n';
import {
	BADGE_KEYS,
	GROUP_CAP,
	GROUP_ORDER,
	ICON_SIZE,
	KIND_ICONS,
	type GroupId,
	type SpotlightGroup,
	type SpotlightRow,
} from './spotlightTypes';

export interface BuildSpotlightDeps {
	query: string;
	language: Language;
	isAdmin: boolean;
	isDark: boolean;
	isMuted: boolean;
	isAmbientSfxEnabled: boolean;
	searchHits: SearchHit[];
	searchLoading: boolean;
	t: (key: string, fallback?: string) => string;
	getAppMeta: (appId: AppID) => ExtendedAppMetadata;
	canUseApp: (appId: AppID) => boolean;
	canManageApp: (appId: AppID) => boolean;
	openApp: (appId: AppID, target?: FocusTargetInput) => void;
	toggleTheme: () => void;
	toggleMute: () => void;
	toggleAmbientSfx: () => void;
	showDocumentation: () => void;
	showSupport: () => void;
	logout: () => void;
}

export function buildSpotlightGroups(deps: BuildSpotlightDeps): SpotlightGroup[] {
	const q = deps.query.trim();
	const otherLanguage = getNextLocale(deps.language);
	const scored = (fields: SearchField[]) => (q ? scoreMatch(q, fields) : 1);
	const rows: SpotlightRow[] = [];

	for (const appId of Object.keys(APPS_CONFIG) as AppID[]) {
		if (!deps.canUseApp(appId)) continue;
		const meta = deps.getAppMeta(appId);
		const score = scored([
			{ text: meta.title, weight: 4 },
			{ text: meta.shortTitle, weight: 4 },
			{ text: meta.description, weight: 1 },
		]);
		if (!score) continue;
		rows.push({
			id: `app:${appId}`,
			group: 'apps',
			title: meta.title,
			subtitle: meta.description,
			badge: deps.t(BADGE_KEYS.apps),
			icon: <LucideByName name={meta.icon} size={ICON_SIZE} color={appIconColor(appId, 'search')} />,
			score,
			run: () => deps.openApp(appId),
		});
	}

	if (q) {
		for (const section of SETTINGS_SECTIONS) {
			if ((section.id === 'integrations' || section.id === 'roles') && !deps.isAdmin) continue;
			if (section.system && !deps.canManageApp('settings')) continue;
			const label = section[deps.language];
			const score = scoreMatch(q, [
				{ text: label, weight: 4 },
				{ text: section[otherLanguage], weight: 2 },
				...section.keywords.map((text) => ({ text, weight: 2 })),
			]);
			if (!score) continue;
			rows.push({
				id: `setting:${section.id}`,
				group: 'settings',
				title: label,
				subtitle: deps.t('spotGroupSettings'),
				badge: deps.t(BADGE_KEYS.settings),
				icon: <SlidersHorizontal size={ICON_SIZE} color="#8e8e93" />,
				score,
				run: () => deps.openApp('settings', { section: section.id }),
			});
		}
	}

	const quickActions = [
		{
			id: 'theme',
			title: deps.isDark ? deps.t('spotlightActThemeLight') : deps.t('spotlightActThemeDark'),
			subtitle: deps.t('spotlightActThemeDesc'),
			icon: deps.isDark ? <Sun size={ICON_SIZE} color="var(--warning)" /> : <Moon size={ICON_SIZE} color="var(--accent)" />,
			run: deps.toggleTheme,
		},
		{
			id: 'sound',
			title: deps.isMuted ? deps.t('spotlightActUnmute') : deps.t('spotlightActMute'),
			subtitle: deps.t('spotlightActSoundDesc'),
			icon: deps.isMuted ? <Volume2 size={ICON_SIZE} color="var(--success)" /> : <VolumeX size={ICON_SIZE} color="var(--danger)" />,
			run: deps.toggleMute,
		},
		{
			id: 'sfx',
			title: deps.isAmbientSfxEnabled ? deps.t('spotlightActSfxOff') : deps.t('spotlightActSfxOn'),
			subtitle: deps.t('spotlightActSfxDesc'),
			icon: <Radio size={ICON_SIZE} color="var(--cyan)" />,
			run: deps.toggleAmbientSfx,
		},
		{
			id: 'docs',
			title: deps.t('spotActHelpDocs'),
			subtitle: deps.t('spotActHelpDocsDesc'),
			icon: <Keyboard size={ICON_SIZE} color="var(--accent)" />,
			run: deps.showDocumentation,
		},
		{
			id: 'support',
			title: deps.t('spotActHelpSupport'),
			subtitle: deps.t('spotlightActHelpSupportDesc'),
			icon: <LifeBuoy size={ICON_SIZE} color="var(--warning)" />,
			run: deps.showSupport,
		},
		{
			id: 'logout',
			title: deps.t('spotlightActLogout'),
			subtitle: deps.t('spotlightActLogoutDesc'),
			icon: <LogOut size={ICON_SIZE} color="var(--danger)" />,
			run: deps.logout,
		},
	];

	for (const action of quickActions) {
		const score = scored([
			{ text: action.title, weight: 4 },
			{ text: action.subtitle, weight: 1 },
		]);
		if (!score) continue;
		rows.push({ ...action, id: `action:${action.id}`, group: 'actions', badge: deps.t(BADGE_KEYS.actions), score });
	}

	for (const hit of deps.searchHits) {
		const { Icon, color } = KIND_ICONS[hit.kind];
		const toPerson = hit.target.section === 'compose';
		rows.push({
			id: hit.id,
			group: hit.kind,
			title: toPerson ? fill(deps.t('spotMessageTo'), { name: hit.title }) : hit.title,
			subtitle: hit.subtitle,
			badge: deps.t(BADGE_KEYS[hit.kind]),
			icon: <Icon size={ICON_SIZE} color={color} />,
			score: hit.score,
			stale: deps.searchLoading,
			run: () => deps.openApp(hit.appId, hit.target),
		});
	}

	const byGroup = new Map<GroupId, SpotlightRow[]>();
	for (const row of rows) {
		const list = byGroup.get(row.group);
		if (list) list.push(row);
		else byGroup.set(row.group, [row]);
	}

	const groups: SpotlightGroup[] = [...byGroup.entries()].map(([id, list]) => {
		const sorted = list.slice().sort((a, b) => b.score - a.score);
		return { id, rows: q ? sorted.slice(0, GROUP_CAP) : sorted, best: sorted[0].score };
	});
	groups.sort((a, b) => (q ? b.best - a.best : 0) || GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));

	return groups;
}
