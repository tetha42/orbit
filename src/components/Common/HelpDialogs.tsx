'use client';

import React, { useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { useDialog } from './DialogProvider';
import { SupportCard, helpDialogRowStyle } from './HelpSupportCard';

export { SupportCard };

const keyStyle: React.CSSProperties = {
	display: 'inline-block',
	minWidth: 22,
	padding: '1px 6px',
	borderRadius: 6,
	fontSize: 11,
	fontWeight: 600,
	textAlign: 'center',
	color: 'var(--text-primary)',
	background: 'var(--input-bg)',
	border: '1px solid var(--input-border)',
};

export function DocumentationShortcuts() {
	const { t } = useI18n();
	const shortcuts: { keys: string[]; labelKey: string }[] = [
		{ keys: ['Shift', 'Space'], labelKey: 'helpShortcutSpotlight' },
		{ keys: ['Shift', '1–8'], labelKey: 'helpShortcutOpenApps' },
		{ keys: ['Shift', 'M'], labelKey: 'helpShortcutMinimize' },
		{ keys: ['Shift', 'W'], labelKey: 'helpShortcutClose' },
		{ keys: ['Shift', 'Tab'], labelKey: 'helpShortcutSwitch' },
		{ keys: [t('helpKeyRightClick'), t('helpKeyHold')], labelKey: 'helpShortcutResize' },
	];
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
			{shortcuts.map((shortcut) => (
				<div key={shortcut.labelKey} style={{ ...helpDialogRowStyle, justifyContent: 'space-between', padding: '6px 10px' }}>
					<span style={{ fontSize: 12 }}>{t(shortcut.labelKey)}</span>
					<span style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
						{shortcut.keys.map((key) => (
							<kbd key={key} style={keyStyle}>
								{key}
							</kbd>
						))}
					</span>
				</div>
			))}
		</div>
	);
}

export function useHelpDialogs() {
	const dialog = useDialog();
	const { t } = useI18n();
	return useMemo(
		() => ({
			showDocumentation: () =>
				void dialog.alert({
					title: t('helpGuideTitle'),
					message: t('helpGuideMessage'),
					tone: 'info',
					body: <DocumentationShortcuts />,
				}),
			showSupport: () =>
				void dialog.alert({
					title: t('helpSupportTitle'),
					tone: 'info',
					body: <SupportCard />,
				}),
		}),
		[dialog, t]
	);
}
