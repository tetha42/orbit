'use client';

import React from 'react';
import type { MailFolderInfo, MailMessageSummary, MailMessageDetail } from '../types';
import { MobileMailboxesScreen } from './mobile/MobileMailboxesScreen';
import { MobileMessageDetailScreen } from './mobile/MobileMessageDetailScreen';
import { MobileMessageListScreen } from './mobile/MobileMessageListScreen';
import { useMailMobileController } from './mobile/useMailMobileController';

interface MailMobileViewProps {
	folders: MailFolderInfo[];
	activeFolder: string;
	onSelectFolder: (folderId: string) => void;
	messages: MailMessageSummary[];
	totalMessages: number;
	page: number;
	pageSize: number;
	onPageChange: (nextPage: number) => void;
	selectedUid: number | null;
	onSelectMessage: (uid: number) => void;
	onDeselectMessage: () => void;
	activeMessage: MailMessageDetail | null;
	isLoadingList: boolean;
	isLoadingDetail: boolean;
	detailError: string | null;
	onRetryDetail: () => void;
	searchQuery: string;
	onSearchChange: (q: string) => void;
	onRefresh: () => void;
	onToggleStar: () => void;
	onToggleRead: () => void;
	onTrash: () => void;
	onRestore?: () => void;
	isTrashFolder: boolean;
	userEmail: string;
	onOpenCompose: () => void;
	onReply: (all?: boolean) => void;
	isComposeOpen: boolean;
	onCloseCompose: () => void;
	composeInitial?: { to?: string; subject?: string; body?: string };
	onSendSuccess: () => void;
	selectedUids?: Set<number>;
	onToggleSelectUid?: (uid: number) => void;
	onSelectAll?: () => void;
	onDeselectAll?: () => void;
	onBatchTrash?: () => void;
	onBatchToggleRead?: (markSeen: boolean) => void;
	onEmptyTrash?: () => void;
}

export const MailMobileView: React.FC<MailMobileViewProps> = ({
	folders,
	activeFolder,
	onSelectFolder,
	messages,
	totalMessages,
	page,
	pageSize,
	onPageChange,
	selectedUid,
	onSelectMessage,
	onDeselectMessage,
	activeMessage,
	isLoadingList,
	isLoadingDetail,
	detailError,
	onRetryDetail,
	searchQuery,
	onSearchChange,
	onRefresh,
	onToggleStar,
	onToggleRead,
	onTrash,
	onRestore,
	isTrashFolder,
	userEmail,
	onOpenCompose,
	onReply,
	isComposeOpen,
	onCloseCompose,
	composeInitial,
	onSendSuccess,
	selectedUids = new Set(),
	onToggleSelectUid,
	onSelectAll,
	onDeselectAll,
	onBatchTrash,
	onBatchToggleRead,
	onEmptyTrash,
}) => {
	const {
		screen,
		setScreen,
		loadRemoteImages,
		setLoadRemoteImages,
		isSelecting,
		setIsSelecting,
		isAllSelected,
		activeFolderTitle,
		totalPages,
		hasRemoteImages,
		iframeSrcDoc,
		activeTabId,
		mailboxesScrollRef,
		messageListScrollRef,
		handleTabChange,
		tabs,
	} = useMailMobileController({
		folders,
		activeFolder,
		messages,
		totalMessages,
		pageSize,
		selectedUid,
		selectedUids,
		activeMessage,
		onSelectFolder,
		onOpenCompose,
	});

	if (screen === 'mailboxes') {
		return (
			<MobileMailboxesScreen
				folders={folders}
				activeFolder={activeFolder}
				userEmail={userEmail}
				mailboxesScrollRef={mailboxesScrollRef}
				onSelectFolder={onSelectFolder}
				onOpenList={() => setScreen('list')}
				onOpenCompose={onOpenCompose}
				onRefresh={onRefresh}
				tabs={tabs}
				activeTabId={activeTabId}
				onTabChange={handleTabChange}
				isComposeOpen={isComposeOpen}
				composeInitial={composeInitial}
				onCloseCompose={onCloseCompose}
				onSendSuccess={onSendSuccess}
			/>
		);
	}

	if (screen === 'detail') {
		return (
			<MobileMessageDetailScreen
				activeFolderTitle={activeFolderTitle}
				activeMessage={activeMessage}
				isLoadingDetail={isLoadingDetail}
				detailError={detailError}
				hasRemoteImages={hasRemoteImages}
				loadRemoteImages={loadRemoteImages}
				iframeSrcDoc={iframeSrcDoc}
				isTrashFolder={isTrashFolder}
				onBack={() => { onDeselectMessage(); setScreen('list'); }}
				onRetryDetail={onRetryDetail}
				onLoadRemoteImages={() => setLoadRemoteImages(true)}
				onToggleStar={onToggleStar}
				onToggleRead={onToggleRead}
				onTrash={onTrash}
				onRestore={onRestore}
				onReply={onReply}
			/>
		);
	}

	return (
		<MobileMessageListScreen
			activeFolderTitle={activeFolderTitle}
			messages={messages}
			totalMessages={totalMessages}
			page={page}
			totalPages={totalPages}
			selectedUid={selectedUid}
			selectedUids={selectedUids}
			isSelecting={isSelecting}
			setIsSelecting={setIsSelecting}
			isAllSelected={isAllSelected}
			isLoadingList={isLoadingList}
			isTrashFolder={isTrashFolder}
			searchQuery={searchQuery}
			messageListScrollRef={messageListScrollRef}
			tabs={tabs}
			activeTabId={activeTabId}
			isComposeOpen={isComposeOpen}
			composeInitial={composeInitial}
			onBackToMailboxes={() => setScreen('mailboxes')}
			onOpenCompose={onOpenCompose}
			onCloseCompose={onCloseCompose}
			onSendSuccess={onSendSuccess}
			onSearchChange={onSearchChange}
			onRefresh={onRefresh}
			onPageChange={onPageChange}
			onSelectMessage={onSelectMessage}
			onOpenDetail={() => setScreen('detail')}
			onToggleSelectUid={onToggleSelectUid}
			onSelectAll={onSelectAll}
			onDeselectAll={onDeselectAll}
			onBatchTrash={onBatchTrash}
			onBatchToggleRead={onBatchToggleRead}
			onEmptyTrash={onEmptyTrash}
			onTabChange={handleTabChange}
		/>
	);
};
