'use client';

import React, { useState } from 'react';
import { Search, RefreshCw, MailOpen, X, ChevronLeft, ChevronRight, CheckSquare, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { MailMessageSummary } from '../types';
import { MailListItem } from './MailListItem';
import { MailBatchToolbar } from './MailBatchToolbar';
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
	const locale = language;
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
							<span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>({total})</span>
						)}
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
						{isTrashFolder && total > 0 && onEmptyTrash && (
							<button type="button" className={styles.emptyTrashHeaderBtn} onClick={onEmptyTrash} title={t('mailEmptyTrash')}>
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
				<MailBatchToolbar
					selectedCount={selectedUids.size}
					isAllSelected={isAllSelected}
					isTrashFolder={isTrashFolder}
					onSelectAll={onSelectAll}
					onDeselectAll={onDeselectAll}
					onBatchToggleRead={onBatchToggleRead}
					onBatchTrash={onBatchTrash}
				/>
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
							{searchQuery ? t('mailNoSearchMatch') : t('mailEmptyFolder')}
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
					<span>{fill(t('mailPageOf'), { page, totalPages, n: page, total: totalPages })}</span>
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
