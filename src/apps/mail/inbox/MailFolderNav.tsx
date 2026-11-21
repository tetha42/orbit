'use client';

import React from 'react';
import { Archive, Inbox, Send, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';

export type FolderChoice = 'inbox' | 'sent' | 'archived' | 'trash';

const FOLDERS: Array<{ key: FolderChoice; labelKey: string; Icon: typeof Inbox }> = [
	{ key: 'inbox', labelKey: 'mailFolderInbox', Icon: Inbox },
	{ key: 'sent', labelKey: 'mailFolderSent', Icon: Send },
	{ key: 'archived', labelKey: 'mailFolderArchive', Icon: Archive },
	{ key: 'trash', labelKey: 'mailFolderTrash', Icon: Trash2 },
];

interface MailFolderNavProps {
	active: FolderChoice;
	unread: number;
	emailNotify: boolean;
	emailNotifyBusy: boolean;
	onSelect: (key: FolderChoice) => void;
	onToggleEmailNotify: (next: boolean) => void;
}

/** The folder rail on the left, with the inbox counter and the "tell me by e-mail too" switch. */
export function MailFolderNav({ active, unread, emailNotify, emailNotifyBusy, onSelect, onToggleEmailNotify }: MailFolderNavProps) {
	const { t } = useI18n();

	return (
		<div style={{ width: 178, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, borderRight: '1px solid var(--window-border)', paddingRight: 10 }}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
				<div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', opacity: 0.55, padding: '0 8px 4px' }}>
					{t('mailFoldersLabel')}
				</div>
				{FOLDERS.map(({ key, labelKey, Icon }) => {
					const selected = key === active;
					return (
						<button
							key={key}
							type="button"
							data-mail-folder={key}
							onClick={() => onSelect(key)}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								padding: '7px 9px',
								borderRadius: 7,
								border: 'none',
								cursor: 'pointer',
								fontSize: 12.5,
								fontWeight: selected ? 700 : 550,
								color: 'inherit',
								background: selected ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
								textAlign: 'left',
							}}
						>
							<Icon size={14} />
							<span style={{ flex: 1 }}>{t(labelKey)}</span>
							{key === 'inbox' && unread > 0 && (
								<span
									data-mail-unread={unread}
									style={{
										minWidth: 17,
										padding: '0 5px',
										borderRadius: 9,
										fontSize: 10.5,
										fontWeight: 800,
										lineHeight: '17px',
										textAlign: 'center',
										background: 'var(--accent)',
										color: 'var(--accent-contrast, #fff)',
									}}
								>
									{unread}
								</span>
							)}
						</button>
					);
				})}
			</div>

			<label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 11, opacity: 0.8, padding: '4px 8px', cursor: 'pointer' }}>
				<input
					type="checkbox"
					data-mail-email-toggle
					checked={emailNotify}
					disabled={emailNotifyBusy}
					onChange={(e) => onToggleEmailNotify(e.target.checked)}
					style={{ marginTop: 2 }}
				/>
				<span>{t('mailEmailNotice')}</span>
			</label>
		</div>
	);
}
