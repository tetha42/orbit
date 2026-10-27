'use client';

import React, { useState } from 'react';
import {
	Search,
	RefreshCw,
	Paperclip,
	Star,
	MailOpen,
	X,
	ChevronLeft,
	ChevronRight,
	CheckSquare,
	Check,
	Trash2,
	Eye,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell';
import type { MenuItem } from '@/types/workspace';
import { fill } from '@/lib/text';
import { formatMailDate } from '../utils';
import type { MailMessageSummary } from '../types';
import styles from '../Mail.module.css';

interface MailListProps {
	folderTitle: string;
	messages: MailMessageSummary[];
	selectedUid: number | null;
	onSelectMessage: (uid: number) => void;
	searchQuery: string;
	onSearchChange: (q: string) => void;
	isLoading: boolean;
	onRefresh: () => void;
	page?: number;
	pageSize?: number;
	total?: number;
	onPageChange?: (nextPage: number) => void;
	selectedUids?: Set<number>;
	onToggleSelectUid?: (uid: number) => void;
	onSelectAll?: () => void;
	onDeselectAll?: () => void;
	onBatchTrash?: () => void;
	onBatchToggleRead?: (markSeen: boolean) => void;
	onToggleStar?: (msg: MailMessageSummary) => void;
	onToggleRead?: (msg: MailMessageSummary) => void;
	isTrashFolder?: boolean;
	onEmptyTrash?: () => void;
}

interface MailListItemProps {
	msg: MailMessageSummary;
	isSelected: boolean;
	isChecked: boolean;
	isSelectMode: boolean;
	showCheckboxes: boolean;
	locale: string;
	t: (k: string) => string;
	onToggleSelectUid?: (uid: number) => void;
	onSelectMessage: (uid: number) => void;
	onBatchTrash?: () => void;
	onToggleStar?: (msg: MailMessageSummary) => void;
	onToggleRead?: (msg: MailMessageSummary) => void;
}

const MailListItem: React.FC<MailListItemProps> = ({
	msg,
	isSelected,
	isChecked,
	isSelectMode,
	showCheckboxes,
	locale,
	t,
	onToggleSelectUid,
	onSelectMessage,
	onBatchTrash,
	onToggleStar,
	onToggleRead,
}) => {
	const menuItems = React.useMemo<MenuItem[]>(() => {
		const items: MenuItem[] = [
			{
				id: `mail-open-${msg.uid}`,
				label: t('ctxMailOpen'),
				icon: <Eye size={13} />,
				action: () => onSelectMessage(msg.uid),
			},
		];

		if (onToggleRead) {
			items.push({
				id: `mail-read-${msg.uid}`,
				label: msg.seen ? t('ctxMailMarkUnread') : t('ctxMailMarkRead'),
				icon: msg.seen ? <MailOpen size={13} /> : <MailOpen size={13} />,
				action: () => onToggleRead(msg),
			});
		}

		if (onToggleStar) {
			items.push({
				id: `mail-star-${msg.uid}`,
				label: msg.flagged ? t('ctxMailUnstar') : t('ctxMailStar'),
				icon: <Star size={13} color={msg.flagged ? '#ffb340' : undefined} fill={msg.flagged ? '#ffb340' : 'none'} />,
				action: () => onToggleStar(msg),
			});
		}

		if (onBatchTrash) {
			items.push(
				{ id: `sep-mail-${msg.uid}`, label: '', separator: true },
				{
					id: `mail-trash-${msg.uid}`,
					label: t('ctxMailDelete'),
					icon: <Trash2 size={13} />,
					danger: true,
					action: () => {
						if (onToggleSelectUid) {
							onToggleSelectUid(msg.uid);
						}
						onBatchTrash();
					},
				}
			);
		}

		return items;
	}, [msg, t, onSelectMessage, onBatchTrash, onToggleSelectUid, onToggleRead, onToggleStar]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<li
			className={`${styles.messageItem} ${isSelected ? styles.messageItemActive : ''}`}
			{...contextMenuProps}
			onClick={() => {
				if (isSelectMode && onToggleSelectUid) {
					onToggleSelectUid(msg.uid);
				} else {
					onSelectMessage(msg.uid);
				}
			}}
		>
			<div className={styles.messageItemRow}>
				{showCheckboxes && (
					<button
						type="button"
						className={`${styles.selectionCheckbox} ${isChecked ? styles.selectionCheckboxChecked : ''}`}
						onClick={(e) => {
							e.stopPropagation();
							onToggleSelectUid?.(msg.uid);
						}}
						title={isChecked ? t('mailDeselectAll') : t('mailSelectAll')}
						style={{ marginTop: 2 }}
					>
						{isChecked && <Check size={11} strokeWidth={3} />}
					</button>
				)}
				<div className={styles.messageItemContent}>
					<div className={styles.messageTopRow}>
						<div className={styles.senderBox}>
							{!msg.seen && <span className={styles.unreadDot} title={t('mailUnread')} />}
							<span title={msg.from.address || msg.from.name}>{msg.from.name}</span>
						</div>
						<span className={styles.messageDate}>{formatMailDate(msg.date, locale, t('mailYesterday'))}</span>
					</div>

					<div className={styles.messageSubject}>{msg.subject || t('mailNoSubject')}</div>

					{msg.snippet && <div className={styles.messageSnippet}>{msg.snippet}</div>}

					{(msg.hasAttachments || msg.flagged) && (
						<div className={styles.messageIconsRow}>
							{msg.hasAttachments && (
								<span
									title={t('mailHasAttachments')}
									style={{ display: 'inline-flex', alignItems: 'center' }}
								>
									<Paperclip size={12} />
								</span>
							)}
							{msg.flagged && (
								<span
									title={t('mailStarred')}
									style={{
										display: 'inline-flex',
										alignItems: 'center',
										color: '#ffb340',
									}}
								>
									<Star size={12} fill="#ffb340" />
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</li>
	);
};

export const MailList: React.FC<MailListProps> = ({
	folderTitle,
	messages,
	selectedUid,
	onSelectMessage,
	searchQuery,
	onSearchChange,
	isLoading,
	onRefresh,
	page = 1,
	pageSize = 25,
	total = 0,
	onPageChange,
	selectedUids = new Set(),
	onToggleSelectUid,
	onSelectAll,
	onDeselectAll,
	onBatchTrash,
	onBatchToggleRead,
	onToggleStar,
	onToggleRead,
	isTrashFolder = false,
	onEmptyTrash,
}) => {
	const { t, language } = useI18n();
	const locale = language === 'tr' ? 'tr-TR' : 'en-US';
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const [isSelectMode, setIsSelectMode] = useState(false);

	const isAllSelected = messages.length > 0 && messages.every((m) => selectedUids.has(m.uid));
	const hasSelected = selectedUids.size > 0;
	const showCheckboxes = isSelectMode || hasSelected;

	return (
		<section className={styles.listPane}>
			<div className={styles.listHeader}>
				<div className={styles.listTitleRow}>
					<div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
						<h2 className={styles.listTitle}>{folderTitle}</h2>
						{total > 0 && (
							<span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
								({total})
							</span>
						)}
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
						{isTrashFolder && total > 0 && onEmptyTrash && (
							<button
								type="button"
								className={styles.emptyTrashHeaderBtn}
								onClick={onEmptyTrash}
								title={t('mailEmptyTrash')}
							>
								<Trash2 size={12} />
								<span>{t('mailEmptyTrash')}</span>
							</button>
						)}
						{messages.length > 0 && (
							<button
								type="button"
								className={`${styles.selectModeBtn} ${showCheckboxes ? styles.selectModeBtnActive : ''}`}
								onClick={() => {
									if (hasSelected && onDeselectAll) {
										onDeselectAll();
										setIsSelectMode(false);
									} else {
										setIsSelectMode((prev) => !prev);
									}
								}}
								title={hasSelected ? t('mailDeselectAll') : t('mailSelectMode')}
							>
								<CheckSquare size={14} />
							</button>
						)}
						<button
							type="button"
							className={styles.refreshBtn}
							onClick={onRefresh}
							disabled={isLoading}
							title={`${t('refresh')} (⌘R)`}
						>
							<RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
						</button>
					</div>
				</div>
				<div className={styles.searchBox}>
					<Search size={14} className={styles.searchIcon} />
					<input
						type="text"
						className={styles.searchInput}
						placeholder={t('mailSearchThisFolder')}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						style={{ paddingRight: searchQuery ? 28 : 10 }}
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => onSearchChange('')}
							title={t('mailClearSearch')}
							style={{
								position: 'absolute',
								right: 6,
								background: 'transparent',
								border: 'none',
								color: 'var(--text-muted)',
								cursor: 'pointer',
								padding: 2,
								display: 'flex',
								alignItems: 'center',
							}}
						>
							<X size={13} />
						</button>
					)}
				</div>
			</div>

			{hasSelected && (
				<div className={styles.batchToolbar}>
					<div className={styles.batchToolbarLeft}>
						<button
							type="button"
							className={`${styles.selectionCheckbox} ${isAllSelected ? styles.selectionCheckboxChecked : ''}`}
							onClick={isAllSelected ? onDeselectAll : onSelectAll}
							title={isAllSelected ? t('mailDeselectAll') : t('mailSelectAll')}
						>
							{isAllSelected && <Check size={12} strokeWidth={3} />}
						</button>
						<span className={styles.batchCount}>
							{fill(t('mailSelectedCount'), { count: selectedUids.size })}
						</span>
					</div>
					<div className={styles.batchToolbarRight}>
						{onBatchToggleRead && (
							<button
								type="button"
								className={styles.batchActionBtn}
								onClick={() => onBatchToggleRead(true)}
								title={t('mailBatchMarkRead')}
							>
								<MailOpen size={13} />
								<span>{t('mailBatchMarkRead')}</span>
							</button>
						)}
						{onBatchTrash && (
							<button
								type="button"
								className={`${styles.batchActionBtn} ${styles.batchActionBtnDanger}`}
								onClick={onBatchTrash}
								title={isTrashFolder ? t('mailBatchDelete') : t('mailBatchTrash')}
							>
								<Trash2 size={13} />
								<span>{isTrashFolder ? t('mailBatchDelete') : t('mailBatchTrash')}</span>
							</button>
						)}
						{onDeselectAll && (
							<button
								type="button"
								className={styles.batchActionBtn}
								onClick={onDeselectAll}
								title={t('mailDeselectAll')}
							>
								<X size={13} />
							</button>
						)}
					</div>
				</div>
			)}

			<ul className={styles.messageList}>
				{isLoading && messages.length === 0 ? (
					<li style={{ padding: '44px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
						<RefreshCw size={24} className="spin-animation" style={{ opacity: 0.5, marginBottom: 10 }} />
						<p style={{ margin: 0, fontSize: 13 }}>{t('mailLoadingList')}</p>
					</li>
				) : messages.length === 0 ? (
					<li style={{ padding: '44px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
						<MailOpen size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
						<p style={{ margin: 0, fontSize: 13 }}>
							{searchQuery
								? t('mailNoSearchMatch')
								: t('mailEmptyFolder')}
						</p>
					</li>
				) : (
					messages.map((msg) => (
						<MailListItem
							key={msg.id || msg.uid}
							msg={msg}
							isSelected={selectedUid === msg.uid}
							isChecked={selectedUids.has(msg.uid)}
							isSelectMode={isSelectMode}
							showCheckboxes={showCheckboxes}
							locale={locale}
							t={t}
							onToggleSelectUid={onToggleSelectUid}
							onSelectMessage={onSelectMessage}
							onBatchTrash={onBatchTrash}
							onToggleStar={onToggleStar}
							onToggleRead={onToggleRead}
						/>
					))
				)}
			</ul>

			{totalPages > 1 && onPageChange && (
				<div
					style={{
						padding: '8px 12px',
						borderTop: '1px solid var(--border-subtle)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						fontSize: 11.5,
						color: 'var(--text-secondary)',
						background: 'var(--card-bg)',
					}}
				>
					<button
						type="button"
						className={styles.actionBtn}
						style={{ padding: '4px 8px' }}
						disabled={page <= 1 || isLoading}
						onClick={() => onPageChange(page - 1)}
					>
						<ChevronLeft size={13} />
						<span>{t('mailPrevPage')}</span>
					</button>
					<span>
						{fill(t('mailPageOf'), { page, totalPages, n: page, total: totalPages })}
					</span>
					<button
						type="button"
						className={styles.actionBtn}
						style={{ padding: '4px 8px' }}
						disabled={page >= totalPages || isLoading}
						onClick={() => onPageChange(page + 1)}
					>
						<span>{t('mailNextPage')}</span>
						<ChevronRight size={13} />
					</button>
				</div>
			)}
		</section>
	);
};
