'use client';

import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { SettingsSection, SettingsTabId } from '@/configs/settings.config';
import { IOS_SETTING_META } from './SettingsMobileMeta';
import s from '../SettingsMobile.module.css';

interface SettingsMobileListProps {
	searchQuery: string;
	visibleSections: SettingsSection[];
	filteredSections: SettingsSection[];
	getValuePreview: (id: SettingsTabId) => string;
	onOpenTab: (tabId: SettingsTabId) => void;
}

function SettingsMobileRows({
	items,
	getValuePreview,
	onOpenTab,
}: {
	items: SettingsSection[];
	getValuePreview: (id: SettingsTabId) => string;
	onOpenTab: (tabId: SettingsTabId) => void;
}) {
	const { t } = useI18n();

	return (
		<>
			{items.map((sec, idx) => {
				const meta = IOS_SETTING_META[sec.id] || {
					bg: 'var(--accent)',
					icon: Sparkles,
				};
				const Icon = meta.icon;
				const val = getValuePreview(sec.id);

				return (
					<React.Fragment key={sec.id}>
						<button type="button" className={s.rowItem} onClick={() => onOpenTab(sec.id)}>
							<div className={s.rowIconBox} style={{ background: meta.bg }}>
								<Icon size={16} strokeWidth={2.2} />
							</div>
							<span className={s.rowLabel}>{t(sec.labelKey)}</span>
							{val && <span className={s.rowValue}>{val}</span>}
							<ChevronRight size={17} color="#8e8e93" style={{ opacity: 0.55 }} />
						</button>
						{idx < items.length - 1 && <div className={s.rowSeparator} />}
					</React.Fragment>
				);
			})}
		</>
	);
}

export function SettingsMobileList({
	searchQuery,
	visibleSections,
	filteredSections,
	getValuePreview,
	onOpenTab,
}: SettingsMobileListProps) {
	const { t } = useI18n();

	const groups: Array<{ key: 'personal' | 'account' | 'system'; title: string }> = [
		{ key: 'personal', title: t('settingsGroupPersonal') },
		{ key: 'account', title: t('settingsGroupAccount') },
		{ key: 'system', title: t('settingsGroupAdmin') },
	];

	if (searchQuery) {
		return (
			<div className={s.groupSection}>
				<div className={s.groupHeader}>{t('settingsSearchResults')}</div>
				<div className={s.groupCard}>
					{filteredSections.length > 0 ? (
						<SettingsMobileRows
							items={filteredSections}
							getValuePreview={getValuePreview}
							onOpenTab={onOpenTab}
						/>
					) : (
						<div style={{ padding: '24px 16px', textAlign: 'center', opacity: 0.6, fontSize: 14 }}>
							{t('noResultsFound')}
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<>
			{groups.map(({ key, title }) => {
				const items = visibleSections.filter((sec) => {
					// Filter out account from grouped list if already shown in Apple ID card
					if (sec.id === 'account') return false;
					return sec.group === key;
				});
				if (items.length === 0) return null;

				return (
					<section key={key} className={s.groupSection}>
						<div className={s.groupHeader}>{title}</div>
						<div className={s.groupCard}>
							<SettingsMobileRows
								items={items}
								getValuePreview={getValuePreview}
								onOpenTab={onOpenTab}
							/>
						</div>
					</section>
				);
			})}
		</>
	);
}
