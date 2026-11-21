'use client';

import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useShellState } from '@/core/shell';
import { useTheme, wallpaperInfo } from '@/core/theme';
import { useSound } from '@/core/sound';
import type { SettingsTabId } from '@/configs/settings.config';
import type { useSettingsNav } from '../hooks/useSettingsNav';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import { SettingsMobileDetail } from './mobile/SettingsMobileDetail';
import { SettingsMobileProfileCard } from './mobile/SettingsMobileProfileCard';
import { SettingsMobileList } from './mobile/SettingsMobileList';
import s from './SettingsMobile.module.css';

interface SettingsMobileViewProps {
	nav: ReturnType<typeof useSettingsNav>;
}

export function SettingsMobileView({ nav }: SettingsMobileViewProps) {
	const { t } = useI18n();
	const { currentUser } = useSession();
	const { theme } = useTheme();
	const { activeWallpaper } = useShellState();
	const { playSystemSound } = useSound();

	const [activeSubTab, setActiveSubTab] = useState<SettingsTabId | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [prevNavTab, setPrevNavTab] = useState<SettingsTabId>(nav.activeTab);

	useMobileSubView(activeSubTab !== null);

	// Sync external deep link requests to the active sub-tab without cascading effect renders
	if (nav.activeTab !== prevNavTab) {
		setPrevNavTab(nav.activeTab);
		if (nav.activeTab !== 'account') {
			setActiveSubTab(nav.activeTab);
		}
	}

	const handleOpenTab = (tabId: SettingsTabId) => {
		playSystemSound();
		nav.setActiveTab(tabId);
		setActiveSubTab(tabId);
	};

	const handleBack = () => {
		playSystemSound();
		setActiveSubTab(null);
	};

	// Value preview shown on the right side of list items
	const getValuePreview = (id: SettingsTabId): string => {
		switch (id) {
			case 'language':
				return t('settingsLangPreview');
			case 'appearance':
				if (theme === 'dark') return t('settingsThemePreviewDark');
				if (theme === 'light') return t('settingsThemePreviewLight');
				return t('settingsThemePreviewAuto');
			case 'security':
				return currentUser?.twoFactorEnabled ? t('settings2faEnabled') : t('settingsSecurityPassword');
			case 'wallpaper': {
				if (!activeWallpaper) return '';
				const info = wallpaperInfo(activeWallpaper);
				const key = info.titleKey || `wp_${info.id.replace(/-/g, '_')}`;
				return t(key, info.title);
			}
			case 'roles':
				return currentUser?.roleInfo?.name || (nav.isAdmin ? 'Admin' : '');
			default:
				return '';
		}
	};

	// Search filtering across visible sections
	const filteredSections = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return nav.visibleSections;
		return nav.visibleSections.filter((sec) => {
			const label = t(sec.labelKey).toLowerCase();
			const tr = sec.tr.toLowerCase();
			const en = sec.en.toLowerCase();
			const keywords = sec.keywords?.map((k) => k.toLowerCase()) || [];
			return (
				label.includes(q) ||
				tr.includes(q) ||
				en.includes(q) ||
				keywords.some((k) => k.includes(q))
			);
		});
	}, [searchQuery, nav.visibleSections, t]);

	const currentSection = nav.visibleSections.find((sec) => sec.id === activeSubTab);
	const subTitle = currentSection ? t(currentSection.labelKey) : '';

	if (activeSubTab !== null) {
		return (
			<SettingsMobileDetail
				activeSubTab={activeSubTab}
				subTitle={subTitle}
				nav={nav}
				onBack={handleBack}
			/>
		);
	}

	const fullName = currentUser ? `${currentUser.name} ${currentUser.surname}`.trim() : t('defaultUser');
	const userInitials = currentUser
		? `${currentUser.name?.[0] || ''}${currentUser.surname?.[0] || ''}`.toUpperCase()
		: 'U';

	return (
		<div className={s.root}>
			<div className={s.scrollContainer}>
				<h1 className={s.largeTitle}>{t('settingsNavTitle')}</h1>

				{/* iOS Search Bar */}
				<div className={s.searchBar}>
					<Search size={16} color="#8e8e93" />
					<input
						type="text"
						className={s.searchInput}
						placeholder={t('search')}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					{searchQuery.length > 0 && (
						<button
							type="button"
							className={s.clearSearchBtn}
							onClick={() => setSearchQuery('')}
							aria-label={t('clear')}
						>
							<X size={12} strokeWidth={3} />
						</button>
					)}
				</div>

				{/* Apple ID Style Profile Card (shown when not searching) */}
				{!searchQuery && (
					<SettingsMobileProfileCard
						profilePhoto={currentUser?.profilePhoto}
						fullName={fullName}
						userInitials={userInitials}
						department={currentUser?.department}
						grade={currentUser?.grade}
						email={currentUser?.email}
						onOpenAccount={() => handleOpenTab('account')}
					/>
				)}

				<SettingsMobileList
					searchQuery={searchQuery}
					visibleSections={nav.visibleSections}
					filteredSections={filteredSections}
					getValuePreview={getValuePreview}
					onOpenTab={handleOpenTab}
				/>

				<footer className={s.systemFooter}>{t('settingsMobileFooter')}</footer>
			</div>
		</div>
	);
}
