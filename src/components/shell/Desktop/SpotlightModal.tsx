'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { useSession } from '@/core/session';
import { useShell } from '@/core/shell';
import { useTheme } from '@/core/theme';
import { APPS_CONFIG } from '@/configs/apps.config';
import { SETTINGS_SECTIONS } from '@/configs/settings.config';
import { LucideByName, appIconColor } from '@/core/apps/icons';
import { useHelpDialogs } from '@/components/Common/HelpDialogs';
import { MIN_QUERY_LENGTH, useServerSearch } from '@/lib/client/useServerSearch';
import { scrollNearest } from '@/lib/client/dom';
import { fill, scoreMatch, type SearchField } from '@/lib/text';
import type { SearchKind } from '@/types/search';
import type { AppID } from '@/types/workspace';
import {
	Award,
	CalendarCheck,
	CornerDownLeft,
	Cpu,
	DollarSign,
	FolderGit2,
	Keyboard,
	LifeBuoy,
	ListChecks,
	LoaderCircle,
	Mail,
	LogOut,
	Moon,
	Newspaper,
	Radio,
	Search,
	SlidersHorizontal,
	Sun,
	Users,
	Volume2,
	VolumeX,
	type LucideIcon,
} from 'lucide-react';

/**
 * The one search box of the desktop.
 *
 * Everything it can open comes through the same `Row` shape, from two kinds of
 * source: things the browser already knows (apps, settings pages, quick actions —
 * matched instantly) and records held by the server (members, teams, events…,
 * from `GET /api/search`, which applies the caller's permissions). Choosing a
 * record calls `openApp(app, target)`: the window opens, lands on the right tab
 * and row, and flashes it — see `useFocusTarget`.
 */

type StaticGroup = 'apps' | 'settings' | 'actions';
type GroupId = StaticGroup | SearchKind;

interface Row {
	id: string;
	group: GroupId;
	title: string;
	subtitle?: string;
	badge: string;
	icon: React.ReactNode;
	score: number;
	/** A record hit that belongs to a query which has since been replaced. */
	stale?: boolean;
	run: () => void;
}

const ICON_SIZE = 18;

const KIND_ICONS: Record<SearchKind, { Icon: LucideIcon; color: string }> = {
	member: { Icon: Users, color: 'var(--success)' },
	team: { Icon: FolderGit2, color: 'var(--accent)' },
	task: { Icon: ListChecks, color: '#5e5ce6' },
	event: { Icon: CalendarCheck, color: 'var(--danger)' },
	news: { Icon: Newspaper, color: 'var(--warning)' },
	item: { Icon: Cpu, color: 'var(--accent)' },
	certificate: { Icon: Award, color: 'var(--warning)' },
	ledger: { Icon: DollarSign, color: 'var(--success)' },
	message: { Icon: Mail, color: 'var(--accent)' },
};

/** Tie-break between groups whose best hits score the same: what people reach for most goes first. */
const GROUP_ORDER: GroupId[] = [
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

const GROUP_LABEL_KEYS: Record<GroupId, string> = {
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

const BADGE_KEYS: Record<GroupId, string> = {
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

/** Static groups are capped like the server caps each record kind, so no group drowns out the rest. */
const GROUP_CAP = 5;

const hintKey: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 4,
	padding: '1px 5px',
	borderRadius: 4,
	background: 'var(--fill-strong)',
	fontSize: 10.5,
	fontWeight: 600,
};

export function SpotlightModal() {
	const { canUseApp, canManageApp, logout, isAdmin } = useSession();
	const { getAppMeta, t, language } = useI18n();
	const { isMuted, toggleMute, isAmbientSfxEnabled, toggleAmbientSfx, playSystemSound } = useSound();
	const { openApp } = useWindowActions();
	const { setIsSpotlightOpen } = useShell();
	const { isDark, toggleTheme } = useTheme();
	const { showDocumentation, showSupport } = useHelpDialogs();

	const [query, setQuery] = useState('');
	const [activeId, setActiveId] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const uid = useId();
	const listId = `${uid}-list`;
	const optionId = (rowId: string) => `${uid}-opt-${rowId}`;

	const search = useServerSearch(query);

	// The parent mounts this only while open, so a fresh instance already starts
	// with empty state and the focus effect below only has to focus the input.
	useEffect(() => {
		const timer = setTimeout(() => inputRef.current?.focus(), 50);
		return () => clearTimeout(timer);
	}, []);

	/* ---------- rows ---------- */

	const q = query.trim();
	const otherLanguage = language === 'tr' ? 'en' : 'tr';
	const scored = (fields: SearchField[]) => (q ? scoreMatch(q, fields) : 1);
	const rows: Row[] = [];

	for (const appId of Object.keys(APPS_CONFIG) as AppID[]) {
		if (!canUseApp(appId)) continue;
		const meta = getAppMeta(appId);
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
			badge: t(BADGE_KEYS.apps),
			icon: <LucideByName name={meta.icon} size={ICON_SIZE} color={appIconColor(appId, 'search')} />,
			score,
			run: () => openApp(appId),
		});
	}

	// Settings pages are only offered once something is typed; listing nine of them
	// under an empty box would bury the apps.
	if (q) {
		for (const section of SETTINGS_SECTIONS) {
			if ((section.id === 'integrations' || section.id === 'roles') && !isAdmin) continue;
			if (section.sistem && !canManageApp('settings')) continue;
			const label = section[language];
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
				subtitle: t('spotGroupSettings'),
				badge: t(BADGE_KEYS.settings),
				icon: <SlidersHorizontal size={ICON_SIZE} color="#8e8e93" />,
				score,
				run: () => openApp('settings', { section: section.id }),
			});
		}
	}

	const quickActions: { id: string; title: string; subtitle: string; icon: React.ReactNode; run: () => void }[] = [
		{
			id: 'theme',
			title: isDark ? t('spotlightActThemeLight') : t('spotlightActThemeDark'),
			subtitle: t('spotlightActThemeDesc'),
			icon: isDark ? <Sun size={ICON_SIZE} color="var(--warning)" /> : <Moon size={ICON_SIZE} color="var(--accent)" />,
			run: toggleTheme,
		},
		{
			id: 'sound',
			title: isMuted ? t('spotlightActUnmute') : t('spotlightActMute'),
			subtitle: t('spotlightActSoundDesc'),
			icon: isMuted ? <Volume2 size={ICON_SIZE} color="var(--success)" /> : <VolumeX size={ICON_SIZE} color="var(--danger)" />,
			run: toggleMute,
		},
		{
			id: 'sfx',
			title: isAmbientSfxEnabled ? t('spotlightActSfxOff') : t('spotlightActSfxOn'),
			subtitle: t('spotlightActSfxDesc'),
			icon: <Radio size={ICON_SIZE} color="#38bdf8" />,
			run: toggleAmbientSfx,
		},
		{
			id: 'docs',
			title: t('spotActHelpDocs'),
			subtitle: t('spotActHelpDocsDesc'),
			icon: <Keyboard size={ICON_SIZE} color="var(--accent)" />,
			run: showDocumentation,
		},
		{
			id: 'support',
			title: t('spotActHelpSupport'),
			subtitle: t('spotActHelpSupportDesc'),
			icon: <LifeBuoy size={ICON_SIZE} color="var(--warning)" />,
			run: showSupport,
		},
		{
			id: 'logout',
			title: t('spotlightActLogout'),
			subtitle: t('spotlightActLogoutDesc'),
			icon: <LogOut size={ICON_SIZE} color="var(--danger)" />,
			run: logout,
		},
	];
	for (const action of quickActions) {
		const score = scored([
			{ text: action.title, weight: 4 },
			{ text: action.subtitle, weight: 1 },
		]);
		if (!score) continue;
		rows.push({ ...action, id: `action:${action.id}`, group: 'actions', badge: t(BADGE_KEYS.actions), score });
	}

	for (const hit of search.hits) {
		const { Icon, color } = KIND_ICONS[hit.kind];
		// A person to message (not a conversation): the server sends the name, the wording is the client's.
		const toPerson = hit.target.section === 'compose';
		rows.push({
			id: hit.id,
			group: hit.kind,
			title: toPerson ? fill(t('spotMessageTo'), { name: hit.title }) : hit.title,
			subtitle: hit.subtitle,
			badge: t(BADGE_KEYS[hit.kind]),
			icon: <Icon size={ICON_SIZE} color={color} />,
			score: hit.score,
			stale: search.loading,
			run: () => openApp(hit.appId, hit.target),
		});
	}

	// Group the rows, best first within a group and — once something is typed —
	// the group holding the best match first overall.
	const byGroup = new Map<GroupId, Row[]>();
	for (const row of rows) {
		const list = byGroup.get(row.group);
		if (list) list.push(row);
		else byGroup.set(row.group, [row]);
	}
	const groups = [...byGroup.entries()].map(([id, list]) => {
		const sorted = list.slice().sort((a, b) => b.score - a.score);
		return { id, rows: q ? sorted.slice(0, GROUP_CAP) : sorted, best: sorted[0].score };
	});
	groups.sort((a, b) => (q ? b.best - a.best : 0) || GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));

	const flat = groups.flatMap((group) => group.rows);
	const activeIndex = Math.max(0, flat.findIndex((row) => row.id === activeId));
	const activeRow: Row | undefined = flat[activeIndex];
	const activeRowId = activeRow?.id;

	// Keep the highlighted row on screen when arrowing past the edge of the list.
	useEffect(() => {
		const list = listRef.current;
		const row = list?.querySelector<HTMLElement>('[data-active="true"]');
		if (list && row) scrollNearest(row, list);
	}, [activeRowId]);

	/* ---------- interaction ---------- */

	const choose = (row: Row) => {
		playSystemSound();
		setIsSpotlightOpen(false);
		row.run();
	};

	const move = (delta: number) => {
		if (flat.length === 0) return;
		setActiveId(flat[(activeIndex + delta + flat.length) % flat.length].id);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Enter or arrows while an input method is composing belong to the IME.
		if (e.nativeEvent.isComposing) return;
		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				setIsSpotlightOpen(false);
				break;
			case 'ArrowDown':
				e.preventDefault();
				move(1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				move(-1);
				break;
			case 'Tab':
				// The box is the only control here; Tab steps through results instead of
				// leaving the dialog for the desktop behind it.
				e.preventDefault();
				move(e.shiftKey ? -1 : 1);
				break;
			case 'Enter':
				e.preventDefault();
				if (activeRow) choose(activeRow);
				break;
		}
	};

	/* ---------- status line ---------- */

	const canSearchRecords = q.length >= MIN_QUERY_LENGTH;
	let status: { text: string; tone: 'info' | 'warn'; busy?: boolean } | null = null;
	if (canSearchRecords && search.failure === 'rate') status = { text: t('spotRateLimited'), tone: 'warn' };
	else if (canSearchRecords && search.failure === 'failed') status = { text: t('spotUnavailable'), tone: 'warn' };
	else if (canSearchRecords && search.loading) status = { text: t('spotSearching'), tone: 'info', busy: true };
	else if (q && !canSearchRecords) status = { text: t('spotHintMinChars'), tone: 'info' };

	let rowIndex = -1;

	return (
		<div
			onClick={() => setIsSpotlightOpen(false)}
			style={{
				position: 'fixed',
				inset: 0,
				background: 'var(--scrim)',
				backdropFilter: 'var(--glass-blur-scrim)',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'flex-start',
				paddingTop: '16vh',
				zIndex: 9999999,
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				onKeyDown={handleKeyDown}
				style={{
					width: '640px',
					maxWidth: '92vw',
					background: 'var(--menu-bg, #1c1c1e)',
					backdropFilter: 'var(--glass-blur-strong)',
					border: '1px solid var(--menu-border, rgba(255, 255, 255, 0.15))',
					borderRadius: '16px',
					boxShadow: 'var(--shadow-panel)',
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{/* Search input bar */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
						padding: '14px 18px',
						borderBottom: '1px solid var(--menu-border, rgba(255, 255, 255, 0.1))',
					}}
				>
					<Search size={20} style={{ opacity: 0.6, flexShrink: 0 }} />
					<input
						ref={inputRef}
						type="text"
						role="combobox"
						aria-expanded="true"
						aria-controls={listId}
						aria-autocomplete="list"
						aria-activedescendant={activeRowId ? optionId(activeRowId) : undefined}
						aria-label={t('spotlightPlaceholder')}
						autoComplete="off"
						autoCorrect="off"
						spellCheck={false}
						maxLength={120}
						placeholder={t('spotlightPlaceholder')}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setActiveId(null);
							if (listRef.current) listRef.current.scrollTop = 0;
						}}
						style={{
							background: 'transparent',
							border: 'none',
							outline: 'none',
							fontSize: '16px',
							width: '100%',
							color: 'inherit',
							fontWeight: 500,
						}}
					/>
					<span
						aria-hidden="true"
						style={{
							fontSize: '11px',
							background: 'var(--fill-strong)',
							padding: '2px 6px',
							borderRadius: '4px',
							opacity: 0.7,
						}}
					>
						ESC
					</span>
				</div>

				{/* Results */}
				<div
					ref={listRef}
					id={listId}
					role="listbox"
					aria-label={t('spotResultsLabel')}
					style={{ maxHeight: 'min(420px, 52vh)', overflowY: 'auto', padding: '6px' }}
				>
					{groups.map((group) => (
						<div key={group.id} role="group" aria-label={t(GROUP_LABEL_KEYS[group.id])}>
							<div
								aria-hidden="true"
								style={{
									fontSize: '10.5px',
									fontWeight: 700,
									letterSpacing: '0.08em',
									textTransform: 'uppercase',
									opacity: 0.5,
									padding: '10px 14px 4px',
								}}
							>
								{t(GROUP_LABEL_KEYS[group.id])}
							</div>
							{group.rows.map((row) => {
								rowIndex += 1;
								const idx = rowIndex;
								const isActive = idx === activeIndex;
								return (
									<div
										key={row.id}
										id={optionId(row.id)}
										role="option"
										aria-selected={isActive}
										data-active={isActive}
										onClick={() => choose(row)}
										onMouseMove={() => {
											if (!isActive) setActiveId(row.id);
										}}
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											gap: '12px',
											padding: '9px 14px',
											borderRadius: '10px',
											background: isActive ? 'var(--accent-blue, #0a84ff)' : 'transparent',
											color: isActive ? '#ffffff' : 'inherit',
											cursor: 'pointer',
											opacity: row.stale ? 0.55 : 1,
											transition: 'background 80ms ease, opacity 120ms ease',
										}}
									>
										<div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
											<div
												style={{
													width: '32px',
													height: '32px',
													flexShrink: 0,
													borderRadius: '8px',
													background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--fill-soft)',
													display: 'grid',
													placeItems: 'center',
												}}
											>
												{row.icon}
											</div>
											<div style={{ minWidth: 0 }}>
												<div
													style={{
														fontSize: '13.5px',
														fontWeight: 600,
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
													}}
												>
													{row.title}
												</div>
												{row.subtitle && (
													<div
														style={{
															fontSize: '11px',
															opacity: isActive ? 0.85 : 0.6,
															overflow: 'hidden',
															textOverflow: 'ellipsis',
															whiteSpace: 'nowrap',
														}}
													>
														{row.subtitle}
													</div>
												)}
											</div>
										</div>

										<span
											style={{
												flexShrink: 0,
												fontSize: '11px',
												opacity: isActive ? 0.9 : 0.5,
												background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--fill-soft)',
												padding: '2px 8px',
												borderRadius: '10px',
											}}
										>
											{row.badge}
										</span>
									</div>
								);
							})}
						</div>
					))}

					{flat.length === 0 && (
						<div style={{ padding: '32px 16px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
							{search.loading && canSearchRecords ? t('spotSearching') : t('spotNoResults')}
						</div>
					)}
				</div>

				{/* Footer: keys on the left, what the search is doing on the right */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: '16px',
						padding: '8px 14px',
						borderTop: '1px solid var(--menu-border, rgba(255, 255, 255, 0.1))',
						fontSize: '11px',
						minHeight: '34px',
					}}
				>
					<div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: '14px', opacity: 0.6, flexShrink: 0 }}>
						<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
							<span style={hintKey}>↑↓</span>
							{t('spotFooterNavigate')}
						</span>
						<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
							<span style={hintKey}>
								<CornerDownLeft size={11} />
							</span>
							{t('spotFooterOpen')}
						</span>
						<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
							<span style={hintKey}>esc</span>
							{t('spotFooterClose')}
						</span>
					</div>
					<div
						role="status"
						aria-live="polite"
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							minWidth: 0,
							textAlign: 'right',
							color: status?.tone === 'warn' ? 'var(--warning)' : 'inherit',
							opacity: status ? (status.tone === 'warn' ? 1 : 0.6) : 0,
						}}
					>
						{status?.busy && <LoaderCircle size={12} className="spot-spinner" aria-hidden="true" />}
						<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status?.text}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
