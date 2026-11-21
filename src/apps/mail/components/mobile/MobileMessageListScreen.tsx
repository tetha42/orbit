'use client';

import React from 'react';
import { ChevronLeft, Search, X, RefreshCw, PenSquare, MailOpen, Trash2 } from 'lucide-react';
import type { MailMessageSummary } from '../../types';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from '../../MailMobile.module.css';
import { MobileMessageCard } from './MobileMessageCard';
import { type MailMobileTab, type MobileTabItem } from './MobileBottomTabBar';
import { MobileMessageListFooter } from './MobileMessageListFooter';
import { MobileComposeSheet } from './MobileComposeSheet';

interface MobileMessageListScreenProps {
	activeFolderTitle: string;
	messages: MailMessageSummary[];
	totalMessages: number;
	page: number;
	totalPages: number;
	selectedUid: number | null;
	selectedUids: Set<number>;
	isSelecting: boolean;
	setIsSelecting: (v: boolean) => void;
	isAllSelected: boolean;
	isLoadingList: boolean;
	isTrashFolder: boolean;
	searchQuery: string;
	messageListScrollRef: React.RefObject<HTMLDivElement | null>;
	tabs: MobileTabItem[];
	activeTabId: MailMobileTab;
	isComposeOpen: boolean;
	composeInitial?: { to?: string; subject?: string; body?: string };
	onBackToMailboxes: () => void;
	onOpenCompose: () => void;
	onCloseCompose: () => void;
	onSendSuccess: () => void;
	onSearchChange: (q: string) => void;
	onRefresh: () => void;
	onPageChange: (nextPage: number) => void;
	onSelectMessage: (uid: number) => void;
	onOpenDetail: () => void;
	onToggleSelectUid?: (uid: number) => void;
	onSelectAll?: () => void;
	onDeselectAll?: () => void;
	onBatchTrash?: () => void;
	onBatchToggleRead?: (markSeen: boolean) => void;
	onEmptyTrash?: () => void;
	onTabChange: (tabId: MailMobileTab) => void;
}

export function MobileMessageListScreen({
	activeFolderTitle,
	messages,
	totalMessages,
	page,
	totalPages,
	selectedUid,
	selectedUids,
	isSelecting,
	setIsSelecting,
	isAllSelected,
	isLoadingList,
	isTrashFolder,
	searchQuery,
	messageListScrollRef,
	tabs,
	activeTabId,
	isComposeOpen,
	composeInitial,
	onBackToMailboxes,
	onOpenCompose,
	onCloseCompose,
	onSendSuccess,
	onSearchChange,
	onRefresh,
	onPageChange,
	onSelectMessage,
	onOpenDetail,
	onToggleSelectUid,
	onSelectAll,
	onDeselectAll,
	onBatchTrash,
	onBatchToggleRead,
	onEmptyTrash,
	onTabChange,
}: MobileMessageListScreenProps) {
	const { t } = useI18n();
	return (
		<div className={s.root}>
			<div className={s.navBar}>
				{isSelecting ? (
					<>
						<button type="button" className={s.selectTextBtn} onClick={isAllSelected ? onDeselectAll : onSelectAll}>
							{isAllSelected ? t('mailDeselectAll') : t('mailSelectAll')}
						</button>
						<span className={s.navTitle} style={{ fontSize: 13, fontWeight: 600 }}>
							{fill(t('mailSelectedCount'), { count: selectedUids.size })}
						</span>
						<button type="button" className={s.selectTextBtn} onClick={() => { setIsSelecting(false); onDeselectAll?.(); }} style={{ fontWeight: 600 }}>
							{t('mailDoneMode')}
						</button>
					</>
				) : (
					<>
						<button type="button" className={s.backBtn} onClick={onBackToMailboxes}>
							<ChevronLeft size={20} />
							<span>{t('mailMailboxes')}</span>
						</button>
						<span className={s.navTitle} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
							{totalMessages > 0 ? fill(t('mailCountMessages'), { count: totalMessages }) : ''}
						</span>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							{messages.length > 0 && (
								<button type="button" className={s.selectTextBtn} onClick={() => setIsSelecting(true)}>
									{t('mailSelectMode')}
								</button>
							)}
							<button type="button" className={s.composeIconBtn} onClick={onOpenCompose} title={t('mailNewMessage')}>
								<PenSquare size={16} />
							</button>
						</div>
					</>
				)}
			</div>

			<div className={s.largeTitleWrap}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<h1 className={s.largeTitle}>{activeFolderTitle}</h1>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						{isTrashFolder && totalMessages > 0 && onEmptyTrash && (
							<button type="button" className={s.emptyTrashMobileBtn} onClick={onEmptyTrash} title={t('mailEmptyTrash')}>
								<Trash2 size={13} />
								<span>{t('mailEmptyTrash')}</span>
							</button>
						)}
						<button type="button" className={s.iconBtn} onClick={onRefresh} disabled={isLoadingList} title={t('refresh')}>
							<RefreshCw size={15} className={isLoadingList ? 'spin-animation' : ''} />
						</button>
					</div>
				</div>
			</div>

			<div className={s.searchWrap}>
				<div className={s.searchBox}>
					<Search size={14} color="var(--text-muted)" />
					<input type="text" className={s.searchInput} placeholder={t('mailSearchPh')} value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
					{searchQuery && (
						<button type="button" className={s.clearSearchBtn} onClick={() => onSearchChange('')} title={t('mailClearSearch')}>
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			<div className={s.messageListScroll} ref={messageListScrollRef}>
				{isLoadingList && messages.length === 0 ? (
					<div className={s.centerEmptyState}>
						<RefreshCw size={26} className="spin-animation" color="var(--accent)" />
						<p style={{ fontSize: 13 }}>{t('mailLoadingList')}</p>
					</div>
				) : messages.length === 0 ? (
					<div className={s.centerEmptyState}>
						<MailOpen size={34} style={{ opacity: 0.4 }} />
						<p style={{ fontSize: 13 }}>{searchQuery ? t('mailNoSearchMatch') : t('mailEmptyFolder')}</p>
					</div>
				) : (
					messages.map((msg) => (
						<MobileMessageCard
							key={msg.id || msg.uid}
							msg={msg}
							isSelected={selectedUid === msg.uid}
							isChecked={selectedUids.has(msg.uid)}
							isSelecting={isSelecting}
							onClick={() => {
								if (isSelecting && onToggleSelectUid) {
									onToggleSelectUid(msg.uid);
								} else {
									onSelectMessage(msg.uid);
									onOpenDetail();
								}
							}}
						/>
					))
				)}
			</div>

			<MobileMessageListFooter
				totalPages={totalPages}
				page={page}
				isLoadingList={isLoadingList}
				isSelecting={isSelecting}
				isTrashFolder={isTrashFolder}
				selectedCount={selectedUids.size}
				tabs={tabs}
				activeTabId={activeTabId}
				onPageChange={onPageChange}
				onBatchToggleRead={onBatchToggleRead}
				onBatchTrash={onBatchTrash}
				onExitSelecting={() => setIsSelecting(false)}
				onTabChange={onTabChange}
				t={t}
			/>

			{isComposeOpen && (
				<MobileComposeSheet composeInitial={composeInitial} onClose={onCloseCompose} onSendSuccess={onSendSuccess} />
			)}
		</div>
	);
}
