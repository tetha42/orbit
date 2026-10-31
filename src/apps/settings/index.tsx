import React from 'react';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useSettingsNav } from './hooks/useSettingsNav';
import { SettingsSidebar } from './components/SettingsSidebar';
import { SettingsMobileView } from './components/SettingsMobileView';
import { AccountPanel } from './components/Account/AccountPanel';
import { WallpaperPanel } from './components/Panels/WallpaperPanel';
import { AppearancePanel } from './components/Panels/AppearancePanel';
import { LanguageSettingsPanel } from './components/Panels/LanguageSettingsPanel';
import { SecurityPanel } from './components/Panels/SecurityPanel';
import { RolesPanel } from './components/Roles/RolesPanel';
import { SmtpSettingsPanel } from './components/Panels/SmtpSettingsPanel';
import { OAuthAppsPanel } from './components/Panels/OAuthAppsPanel';
import { CommunitySettingsPanel } from './components/Panels/CommunitySettingsPanel';
import { MembershipPolicyPanel } from './components/Panels/MembershipPolicyPanel';
import { PrivacyDataPanel } from './components/Panels/PrivacyDataPanel';
import { LegalSettingsPanel } from './components/Panels/LegalSettingsPanel';
import { FormDesignerPanel } from './components/Panels/FormDesignerPanel';
import { TeamCategoriesPanel } from './components/Panels/TeamCategoriesPanel';

/**
 * System & Preferences Application.
 * Responsive macOS split-pane & authentic iOS Settings mobile view.
 */
export function SettingsApp() {
	const nav = useSettingsNav();
	const isMobile = useIsMobile();

	if (isMobile) {
		return <SettingsMobileView nav={nav} />;
	}

	const { visibleSections, activeTab, setActiveTab, isAdmin, yonetici } = nav;

	return (
		<div style={{ display: 'flex', height: '100%', minHeight: '100%', flex: 1, color: 'var(--text-primary)' }}>
			<SettingsSidebar
				visibleSections={visibleSections}
				activeTab={activeTab}
				onSelectTab={setActiveTab}
			/>

			<div
				style={{
					flex: 1,
					height: '100%',
					overflowY: 'auto',
					overflowX: 'hidden',
					padding: '20px 24px',
					display: 'flex',
					flexDirection: 'column',
					gap: '20px',
					background: 'var(--right-content-bg)',
				}}
			>
				{(activeTab === 'account' || (activeTab as string) === 'storage') && <AccountPanel />}
				{activeTab === 'wallpaper' && <WallpaperPanel />}
				{(activeTab === 'appearance' || (activeTab as string) === 'dock' || (activeTab as string) === 'display' || (activeTab as string) === 'sound') && <AppearancePanel />}
				{activeTab === 'language' && <LanguageSettingsPanel />}
				{activeTab === 'security' && <SecurityPanel />}
				{activeTab === 'community' && yonetici && <CommunitySettingsPanel />}
				{activeTab === 'membership' && yonetici && <MembershipPolicyPanel />}
				{activeTab === 'legal' && yonetici && <LegalSettingsPanel />}
				{activeTab === 'forms' && yonetici && <FormDesignerPanel />}
				{activeTab === 'teams' && yonetici && <TeamCategoriesPanel />}
				{activeTab === 'roles' && isAdmin && <RolesPanel />}
				{activeTab === 'privacy' && isAdmin && <PrivacyDataPanel />}
				{activeTab === 'smtp' && <SmtpSettingsPanel />}
				{activeTab === 'integrations' && isAdmin && <OAuthAppsPanel />}
			</div>
		</div>
	);
}
