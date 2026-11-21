'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { SettingsTabId } from '@/configs/settings.config';
import type { useSettingsNav } from '../../hooks/useSettingsNav';
import { AccountPanel } from '../Account/AccountPanel';
import { WallpaperPanel } from '../Panels/WallpaperPanel';
import { AppearancePanel } from '../Panels/AppearancePanel';
import { LanguageSettingsPanel } from '../Panels/LanguageSettingsPanel';
import { SecurityPanel } from '../Panels/SecurityPanel';
import { CommunitySettingsPanel } from '../Panels/CommunitySettingsPanel';
import { MembershipPolicyPanel } from '../Panels/MembershipPolicyPanel';
import { PrivacyDataPanel } from '../Panels/PrivacyDataPanel';
import { LegalSettingsPanel } from '../Panels/LegalSettingsPanel';
import { FormDesignerPanel } from '../Panels/FormDesignerPanel';
import { TeamCategoriesPanel } from '../Panels/TeamCategoriesPanel';
import { RolesPanel } from '../Roles/RolesPanel';
import { SmtpSettingsPanel } from '../Panels/SmtpSettingsPanel';
import { OAuthAppsPanel } from '../Panels/OAuthAppsPanel';
import s from '../SettingsMobile.module.css';

interface SettingsMobileDetailProps {
	activeSubTab: SettingsTabId;
	subTitle: string;
	nav: ReturnType<typeof useSettingsNav>;
	onBack: () => void;
}

export function SettingsMobileDetail({
	activeSubTab,
	subTitle,
	nav,
	onBack,
}: SettingsMobileDetailProps) {
	const { t } = useI18n();

	return (
		<div className={s.detailContainer}>
			{/* iOS Top Navigation Bar */}
			<header className={s.detailNavBar}>
				<button
					type="button"
					onClick={onBack}
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
				{(activeSubTab === 'appearance' || (activeSubTab as string) === 'dock') && <AppearancePanel />}
				{(activeSubTab as string) === 'storage' && <AccountPanel />}
				{activeSubTab === 'language' && <LanguageSettingsPanel />}
				{activeSubTab === 'security' && <SecurityPanel />}
				{activeSubTab === 'community' && nav.admin && <CommunitySettingsPanel />}
				{activeSubTab === 'membership' && nav.admin && <MembershipPolicyPanel />}
				{activeSubTab === 'legal' && nav.admin && <LegalSettingsPanel />}
				{activeSubTab === 'forms' && nav.admin && <FormDesignerPanel />}
				{activeSubTab === 'teams' && nav.admin && <TeamCategoriesPanel />}
				{activeSubTab === 'roles' && nav.isAdmin && <RolesPanel />}
				{activeSubTab === 'privacy' && nav.isAdmin && <PrivacyDataPanel />}
				{activeSubTab === 'smtp' && <SmtpSettingsPanel />}
				{activeSubTab === 'integrations' && nav.isAdmin && <OAuthAppsPanel />}
			</main>
		</div>
	);
}
