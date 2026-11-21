'use client';

import React from 'react';
import { RefreshCw, PenSquare, Mail as MailIcon, ChevronRight } from 'lucide-react';
import type { MailFolderInfo } from '../../types';
import { useI18n } from '@/core/i18n';
import { getFolderDisplayName } from '../../utils';
import s from '../../MailMobile.module.css';
import { getFolderIcon } from './mailMobileUtils';
import { MobileBottomTabBar, type MailMobileTab, type MobileTabItem } from './MobileBottomTabBar';
import { MobileComposeSheet } from './MobileComposeSheet';

interface MobileMailboxesScreenProps {
	folders: MailFolderInfo[];
	activeFolder: string;
	userEmail: string;
	mailboxesScrollRef: React.RefObject<HTMLDivElement | null>;
	onSelectFolder: (folderId: string) => void;
	onOpenList: () => void;
	onOpenCompose: () => void;
	onRefresh: () => void;
	tabs: MobileTabItem[];
	activeTabId: MailMobileTab;
	onTabChange: (tabId: MailMobileTab) => void;
	isComposeOpen: boolean;
	composeInitial?: { to?: string; subject?: string; body?: string };
	onCloseCompose: () => void;
	onSendSuccess: () => void;
}

export function MobileMailboxesScreen({
	folders,
	activeFolder,
	userEmail,
	mailboxesScrollRef,
	onSelectFolder,
	onOpenList,
	onOpenCompose,
	onRefresh,
	tabs,
	activeTabId,
	onTabChange,
	isComposeOpen,
	composeInitial,
	onCloseCompose,
	onSendSuccess,
}: MobileMailboxesScreenProps) {
	const { t } = useI18n();
	return (
		<div className={s.root}>
			<div className={s.navBar}>
				<span style={{ width: 40 }} />
				<span style={{ flex: 1 }} />
				<button type="button" className={s.composeIconBtn} onClick={onOpenCompose} title={t('mailNewMessage')}>
					<PenSquare size={16} />
				</button>
			</div>

			<div className={s.largeTitleWrap}>
				<h1 className={s.largeTitle}>{t('mailMailboxes')}</h1>
			</div>

			<div className={s.mailboxesScroll} ref={mailboxesScrollRef}>
				<div className={s.sectionHeader}>{t('mailFolders')}</div>
				<div className={s.groupedTable}>
					{folders.map((folder) => {
						const isCurrent = activeFolder === folder.id;
						return (
							<div
								key={folder.id}
								className={s.groupedRow}
								onClick={() => {
									onSelectFolder(folder.id);
									onOpenList();
								}}
							>
								<div className={s.groupedRowLeft}>
									{getFolderIcon(folder.role)}
									<span style={{ fontWeight: isCurrent ? 700 : 500 }}>{getFolderDisplayName(folder, t)}</span>
								</div>
								<div className={s.groupedRowRight}>
									{folder.unread > 0 && <span className={s.unreadBadge}>{folder.unread}</span>}
									<ChevronRight size={16} className={s.chevronRight} />
								</div>
							</div>
						);
					})}
				</div>

				<div className={s.accountInfoBar}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<MailIcon size={13} />
						<span>{userEmail || 'Gmail IMAP'}</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<span>{t('mailPortSsl')}</span>
						<button
							type="button"
							onClick={onRefresh}
							style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', display: 'flex', padding: 2 }}
							title={t('refresh')}
						>
							<RefreshCw size={12} />
						</button>
					</div>
				</div>
			</div>

			<MobileBottomTabBar tabs={tabs} activeTabId={activeTabId} onTabChange={onTabChange} ariaLabel={t('mailMobNavAria')} />

			{isComposeOpen && (
				<MobileComposeSheet composeInitial={composeInitial} onClose={onCloseCompose} onSendSuccess={onSendSuccess} />
			)}
		</div>
	);
}
