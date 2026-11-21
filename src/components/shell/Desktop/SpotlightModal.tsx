'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { useSession } from '@/core/session';
import { useShell } from '@/core/shell';
import { useTheme } from '@/core/theme';
import { useHelpDialogs } from '@/components/Common/HelpDialogs';
import { MIN_QUERY_LENGTH, useServerSearch } from '@/lib/client/useServerSearch';
import { scrollNearest } from '@/lib/client/dom';
import { buildSpotlightGroups } from './spotlight/buildSpotlightRows';
import { SpotlightFooter, type SpotlightStatus } from './spotlight/SpotlightFooter';
import { SpotlightResultsList } from './spotlight/SpotlightResultsList';
import type { SpotlightRow } from './spotlight/spotlightTypes';

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

	useEffect(() => {
		const timer = setTimeout(() => inputRef.current?.focus(), 50);
		return () => clearTimeout(timer);
	}, []);

	const q = query.trim();
	const groups = buildSpotlightGroups({
		query,
		language,
		isAdmin,
		isDark,
		isMuted,
		isAmbientSfxEnabled,
		searchHits: search.hits,
		searchLoading: search.loading,
		t,
		getAppMeta,
		canUseApp,
		canManageApp,
		openApp,
		toggleTheme,
		toggleMute,
		toggleAmbientSfx,
		showDocumentation,
		showSupport,
		logout,
	});

	const flat = groups.flatMap((group) => group.rows);
	const activeIndex = Math.max(0, flat.findIndex((row) => row.id === activeId));
	const activeRow: SpotlightRow | undefined = flat[activeIndex];
	const activeRowId = activeRow?.id;

	useEffect(() => {
		const list = listRef.current;
		const row = list?.querySelector<HTMLElement>('[data-active="true"]');
		if (list && row) scrollNearest(row, list);
	}, [activeRowId]);

	const choose = (row: SpotlightRow) => {
		playSystemSound();
		setIsSpotlightOpen(false);
		row.run();
	};

	const move = (delta: number) => {
		if (flat.length === 0) return;
		setActiveId(flat[(activeIndex + delta + flat.length) % flat.length].id);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
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
				e.preventDefault();
				move(e.shiftKey ? -1 : 1);
				break;
			case 'Enter':
				e.preventDefault();
				if (activeRow) choose(activeRow);
				break;
		}
	};

	const canSearchRecords = q.length >= MIN_QUERY_LENGTH;
	let status: SpotlightStatus | null = null;
	if (canSearchRecords && search.failure === 'rate') status = { text: t('spotRateLimited'), tone: 'warn' };
	else if (canSearchRecords && search.failure === 'failed') status = { text: t('spotUnavailable'), tone: 'warn' };
	else if (canSearchRecords && search.loading) status = { text: t('spotSearching'), tone: 'info', busy: true };
	else if (q && !canSearchRecords) status = { text: t('spotHintMinChars'), tone: 'info' };

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

				<SpotlightResultsList
					listRef={listRef}
					listId={listId}
					optionId={optionId}
					groups={groups}
					activeIndex={activeIndex}
					empty={flat.length === 0}
					isSearching={search.loading && canSearchRecords}
					onChoose={choose}
					onHoverRow={setActiveId}
				/>

				<SpotlightFooter status={status} />
			</div>
		</div>
	);
}
