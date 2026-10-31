'use client';

import React, { useState, useMemo } from 'react';
import {
	ChevronLeft,
	ChevronRight,
	Search,
	X,
	FileText,
	ListChecks,
	UserRound,
	UserPlus,
	Users,
	Image as ImageIcon,
	Layout,
	Sparkles,
	Database,
	Globe,
	ShieldAlert,
	ShieldCheck,
	KeyRound,
	Mail,
	Network,
	Building2,
	type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useSession } from '@/core/session';
import { useShellState } from '@/core/shell';
import { useTheme, wallpaperInfo } from '@/core/theme';
import { useSound } from '@/core/sound';
import type { SettingsTabId } from '@/configs/settings.config';
import type { useSettingsNav } from '../hooks/useSettingsNav';
import { AccountPanel } from './Account/AccountPanel';
import { WallpaperPanel } from './Panels/WallpaperPanel';
import { DockSettingsPanel } from './Panels/DockSettingsPanel';
import { AppearancePanel } from './Panels/AppearancePanel';
import { StorageSettingsPanel } from './Panels/StorageSettingsPanel';
import { LanguageSettingsPanel } from './Panels/LanguageSettingsPanel';
import { SecurityPanel } from './Panels/SecurityPanel';
import { CommunitySettingsPanel } from './Panels/CommunitySettingsPanel';
import { MembershipPolicyPanel } from './Panels/MembershipPolicyPanel';
import { PrivacyDataPanel } from './Panels/PrivacyDataPanel';
import { LegalSettingsPanel } from './Panels/LegalSettingsPanel';
import { FormDesignerPanel } from './Panels/FormDesignerPanel';
import { TeamCategoriesPanel } from './Panels/TeamCategoriesPanel';
import { RolesPanel } from './Roles/RolesPanel';
import { SmtpSettingsPanel } from './Panels/SmtpSettingsPanel';
import { OAuthAppsPanel } from './Panels/OAuthAppsPanel';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import s from './SettingsMobile.module.css';

interface SettingsMobileViewProps {
	nav: ReturnType<typeof useSettingsNav>;
}

interface SettingMeta {
	bg: string;
	icon: LucideIcon;
}

const IOS_SETTING_META: Record<SettingsTabId, SettingMeta> = {
	account: { bg: 'linear-gradient(135deg, #007aff, #0056b3)', icon: UserRound },
	wallpaper: { bg: 'linear-gradient(135deg, #32ade6, #0077a6)', icon: ImageIcon },
	dock: { bg: 'linear-gradient(135deg, #007aff, #0051ba)', icon: Layout },
	appearance: { bg: 'linear-gradient(135deg, #5856d6, #3634a3)', icon: Sparkles },
	storage: { bg: 'linear-gradient(135deg, #8e8e93, #636366)', icon: Database },
	language: { bg: 'linear-gradient(135deg, #ff9500, #c97700)', icon: Globe },
	security: { bg: 'linear-gradient(135deg, #34c759, #248a3d)', icon: ShieldCheck },
	community: { bg: 'linear-gradient(135deg, #6366f1, #4338ca)', icon: Building2 },
	membership: { bg: 'linear-gradient(135deg, #0a84ff, #0056b3)', icon: UserPlus },
	legal: { bg: 'linear-gradient(135deg, #0a84ff, #0056b3)', icon: FileText },
	forms: { bg: 'linear-gradient(135deg, #30d158, #248a3d)', icon: ListChecks },
	teams: { bg: 'linear-gradient(135deg, #0a84ff, #0056b3)', icon: Users },
	roles: { bg: 'linear-gradient(135deg, #ff3b30, #c41c14)', icon: KeyRound },
	privacy: { bg: 'linear-gradient(135deg, #ff453a, #7f1d1d)', icon: ShieldAlert },
	smtp: { bg: 'linear-gradient(135deg, #007aff, #0056b3)', icon: Mail },
	integrations: { bg: 'linear-gradient(135deg, #af52de, #7e22ce)', icon: Network },
};

export function SettingsMobileView({ nav }: SettingsMobileViewProps) {
	const { t } = useI18n();
	const { currentUser } = useSession();
	const { theme } = useTheme();
	const { isDockAutoHide, activeWallpaper } = useShellState();
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
				return currentUser?.twoFactorEnabled
					? t('settings2faEnabled')
					: t('settingsSecurityPassword');
			case 'dock':
				return isDockAutoHide
					? t('settingsDockHide')
					: t('settingsDockPinned');
			case 'wallpaper': {
				if (!activeWallpaper) return '';
				const info = wallpaperInfo(activeWallpaper);
				const key = info.titleKey || `wp_${info.id.replace(/-/g, '_')}`;
				return t(key, info.title);
			}
			case 'roles':
				return currentUser?.rolBilgi?.ad || (nav.isAdmin ? 'Admin' : '');
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

	// Title for current sub-panel
	const currentSection = nav.visibleSections.find((s) => s.id === activeSubTab);
	const subTitle = currentSection ? t(currentSection.labelKey) : '';

	// Render detail sub-screen if an item is selected
	if (activeSubTab !== null) {
		return (
			<div className={s.detailContainer}>
				{/* iOS Top Navigation Bar */}
				<header className={s.detailNavBar}>
					<button
						type="button"
						onClick={handleBack}
						className={s.detailBackBtn}
						aria-label={t('settingsBackToSettingsAria')}
					>
						<ChevronLeft size={22} strokeWidth={2.6} />
						<span>{t('settingsNavTitle')}</span>
					</button>

					<div className={s.detailNavTitle}>{subTitle}</div>

					<div className={s.detailNavSpacer} />
				</header>

				{/* Panel Content Body */}
				<main className={s.detailContent}>
					{activeSubTab === 'account' && <AccountPanel />}
					{activeSubTab === 'wallpaper' && <WallpaperPanel />}
					{activeSubTab === 'dock' && <DockSettingsPanel />}
					{activeSubTab === 'appearance' && <AppearancePanel />}
					{activeSubTab === 'storage' && (
						<StorageSettingsPanel
							resetMessage={nav.resetMessage}
							onReset={nav.handleReset}
						/>
					)}
					{activeSubTab === 'language' && <LanguageSettingsPanel />}
					{activeSubTab === 'security' && <SecurityPanel />}
					{activeSubTab === 'community' && nav.yonetici && <CommunitySettingsPanel />}
					{activeSubTab === 'membership' && nav.yonetici && <MembershipPolicyPanel />}
					{activeSubTab === 'legal' && nav.yonetici && <LegalSettingsPanel />}
					{activeSubTab === 'forms' && nav.yonetici && <FormDesignerPanel />}
					{activeSubTab === 'teams' && nav.yonetici && <TeamCategoriesPanel />}
					{activeSubTab === 'roles' && nav.isAdmin && <RolesPanel />}
					{activeSubTab === 'privacy' && nav.isAdmin && <PrivacyDataPanel />}
					{activeSubTab === 'smtp' && <SmtpSettingsPanel />}
					{activeSubTab === 'integrations' && nav.isAdmin && <OAuthAppsPanel />}
				</main>
			</div>
		);
	}

	// Root Screen (iOS Settings Overview)
	const fullName = currentUser ? `${currentUser.ad} ${currentUser.soyad}`.trim() : t('defaultUser');
	const userInitials = currentUser
		? `${currentUser.ad?.[0] || ''}${currentUser.soyad?.[0] || ''}`.toUpperCase()
		: 'U';

	const groups: Array<{ key: 'kisisel' | 'hesap' | 'sistem'; title: string }> = [
		{ key: 'kisisel', title: t('settingsGroupPersonal') },
		{ key: 'hesap', title: t('settingsGroupAccount') },
		{ key: 'sistem', title: t('settingsGroupAdmin') },
	];

	return (
		<div className={s.root}>
			<div className={s.scrollContainer}>
				{/* Large Title */}
				<h1 className={s.largeTitle}>
					{t('settingsNavTitle')}
				</h1>

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
					<button
						type="button"
						className={s.profileCard}
						onClick={() => handleOpenTab('account')}
					>
						<div className={s.profileAvatarWrap}>
							{currentUser?.profilFoto ? (
								/* eslint-disable-next-line @next/next/no-img-element */
								<img
									src={currentUser.profilFoto}
									alt={fullName}
									className={s.profileAvatarImg}
								/>
							) : (
								<div className={s.profileAvatarInitials}>
									{userInitials}
								</div>
							)}
						</div>

						<div className={s.profileInfo}>
							<div className={s.profileName}>{fullName}</div>
							<div className={s.profileSubtitle}>
								{currentUser?.bolum
									? `${currentUser.bolum}${currentUser.sinif ? ` • ${fill(t('membersClassYear'), { year: currentUser.sinif })}` : ''}`
									: currentUser?.email || t('settingsProfileCardFallback')}
							</div>
						</div>

						<ChevronRight size={18} color="#8e8e93" style={{ opacity: 0.6 }} />
					</button>
				)}

				{/* Inset Grouped Settings Lists */}
				{searchQuery ? (
					/* Search results list */
					<div className={s.groupSection}>
						<div className={s.groupHeader}>
							{t('settingsSearchResults')}
						</div>
						<div className={s.groupCard}>
							{filteredSections.length > 0 ? (
								filteredSections.map((sec, idx) => {
									const meta = IOS_SETTING_META[sec.id] || {
										bg: 'var(--accent)',
										icon: Sparkles,
									};
									const Icon = meta.icon;
									const val = getValuePreview(sec.id);
									return (
										<React.Fragment key={sec.id}>
											<button
												type="button"
												className={s.rowItem}
												onClick={() => handleOpenTab(sec.id)}
											>
												<div
													className={s.rowIconBox}
													style={{ background: meta.bg }}
												>
													<Icon size={16} strokeWidth={2.2} />
												</div>
												<span className={s.rowLabel}>{t(sec.labelKey)}</span>
												{val && <span className={s.rowValue}>{val}</span>}
												<ChevronRight
													size={17}
													color="#8e8e93"
													style={{ opacity: 0.55 }}
												/>
											</button>
											{idx < filteredSections.length - 1 && (
												<div className={s.rowSeparator} />
											)}
										</React.Fragment>
									);
								})
							) : (
								<div style={{ padding: '24px 16px', textAlign: 'center', opacity: 0.6, fontSize: 14 }}>
									{t('noResultsFound')}
								</div>
							)}
						</div>
					</div>
				) : (
					/* Categorized Grouped Lists */
					groups.map(({ key, title }) => {
						const items = nav.visibleSections.filter((sec) => {
							// Filter out account from grouped list if already shown in Apple ID card
							if (sec.id === 'account') return false;
							return sec.group === key;
						});
						if (items.length === 0) return null;

						return (
							<section key={key} className={s.groupSection}>
								<div className={s.groupHeader}>{title}</div>
								<div className={s.groupCard}>
									{items.map((sec, idx) => {
										const meta = IOS_SETTING_META[sec.id] || {
											bg: 'var(--accent)',
											icon: Sparkles,
										};
										const Icon = meta.icon;
										const val = getValuePreview(sec.id);

										return (
											<React.Fragment key={sec.id}>
												<button
													type="button"
													className={s.rowItem}
													onClick={() => handleOpenTab(sec.id)}
												>
													<div
														className={s.rowIconBox}
														style={{ background: meta.bg }}
													>
														<Icon size={16} strokeWidth={2.2} />
													</div>
													<span className={s.rowLabel}>{t(sec.labelKey)}</span>
													{val && <span className={s.rowValue}>{val}</span>}
													<ChevronRight
														size={17}
														color="#8e8e93"
														style={{ opacity: 0.55 }}
													/>
												</button>
												{idx < items.length - 1 && (
													<div className={s.rowSeparator} />
												)}
											</React.Fragment>
										);
									})}
								</div>
							</section>
						);
					})
				)}

				{/* iOS System Footer */}
				<footer className={s.systemFooter}>
					{t('settingsMobileFooter')}
				</footer>
			</div>
		</div>
	);
}
