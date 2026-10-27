'use client';

import React from 'react';
import {
	Inbox,
	Star,
	Send,
	FileText,
	Trash2,
	AlertOctagon,
	Folder,
	PenSquare,
	Mail as MailIcon,
	RefreshCw,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { getFolderDisplayName } from '../utils';
import type { MailFolderInfo } from '../types';
import styles from '../Mail.module.css';

interface MailSidebarProps {
	folders: MailFolderInfo[];
	activeFolder: string;
	onSelectFolder: (folderId: string) => void;
	onOpenCompose: () => void;
	userEmail: string;
	isLoading: boolean;
	onRefresh: () => void;
}

export const MailSidebar: React.FC<MailSidebarProps> = ({
	folders,
	activeFolder,
	onSelectFolder,
	onOpenCompose,
	userEmail,
	isLoading,
	onRefresh,
}) => {
	const { t } = useI18n();

	const getFolderIcon = (role: MailFolderInfo['role']) => {
		switch (role) {
			case 'inbox':
				return <Inbox size={15} />;
			case 'starred':
				return <Star size={15} />;
			case 'sent':
				return <Send size={15} />;
			case 'drafts':
				return <FileText size={15} />;
			case 'trash':
				return <Trash2 size={15} />;
			case 'spam':
				return <AlertOctagon size={15} />;
			default:
				return <Folder size={15} />;
		}
	};

	return (
		<aside className={styles.sidebar}>
			<button
				type="button"
				className={styles.composeBtn}
				onClick={onOpenCompose}
				title={t('mailNewMessageDesc')}
			>
				<PenSquare size={16} />
				<span>{t('mailNewMessage')}</span>
			</button>

			<div className={styles.folderSectionTitle}>{t('mailMailboxes')}</div>

			<ul className={styles.folderList}>
				{folders.map((folder) => {
					const isActive = activeFolder === folder.id;
					const displayName = getFolderDisplayName(folder, t);
					return (
						<li
							key={folder.id}
							className={`${styles.folderItem} ${isActive ? styles.folderItemActive : ''}`}
							onClick={() => onSelectFolder(folder.id)}
							title={displayName}
						>
							<div className={styles.folderLeft}>
								{getFolderIcon(folder.role)}
								<span>{displayName}</span>
							</div>
							{folder.unread > 0 && (
								<span className={styles.folderBadge}>{folder.unread}</span>
							)}
						</li>
					);
				})}
			</ul>

			<div className={styles.sidebarFooter}>
				<div className={styles.syncIndicator}>
					<MailIcon size={13} />
					<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail || 'Gmail IMAP'}</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
					<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('mailPortSsl')}</span>
					<button
						type="button"
						onClick={onRefresh}
						disabled={isLoading}
						style={{
							background: 'transparent',
							border: 'none',
							color: 'var(--text-secondary)',
							cursor: isLoading ? 'default' : 'pointer',
							padding: 2,
							display: 'flex',
						}}
						title={t('refresh')}
					>
						<RefreshCw size={12} className={isLoading ? 'spin-animation' : ''} />
					</button>
				</div>
			</div>
		</aside>
	);
};
