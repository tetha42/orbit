'use client';

import React from 'react';
import { useSession } from '@/core/session/SessionProvider';
import { useAppCommand } from '@/core/commands';
import { useIsMobile } from '@/lib/client/useClientValue';
import { useI18n } from '@/core/i18n';
import type { AppID } from '@/types/workspace';
import { MailSidebar } from './components/MailSidebar';
import { MailList } from './components/MailList';
import { MailDetail } from './components/MailDetail';
import { MailComposeModal } from './components/MailComposeModal';
import { MailMobileView } from './components/MailMobileView';
import { MailConnectionErrorState, MailUnauthorizedState } from './components/MailGateStates';
import { MailOutboxPrompt } from './components/MailOutboxPrompt';
import { useMailOutbox } from './hooks/useMailOutbox';
import { useMailMailbox } from './hooks/useMailMailbox';
import { useMailActions } from './hooks/useMailActions';
import { useMailCompose } from './hooks/useMailCompose';
import { getFolderDisplayName } from './utils';
import styles from './Mail.module.css';

export const ImapMailView: React.FC = () => {
	const { isAdmin } = useSession();
	const isMobile = useIsMobile();
	const { t } = useI18n();

	const outboxState = useMailOutbox(isAdmin);
	const mailbox = useMailMailbox(isAdmin);
	const activeFolderObj = mailbox.folders.find((f) => f.id === mailbox.activeFolder);
	const isTrashFolder =
		activeFolderObj?.role === 'trash' ||
		mailbox.activeFolder.toLowerCase().includes('trash') ||
		mailbox.activeFolder.toLowerCase().includes('\u00e7\u00f6p');

	const actions = useMailActions({
		activeFolder: mailbox.activeFolder,
		isTrashFolder,
		selectedRef: mailbox.selectedRef,
		setSelectedRef: mailbox.setSelectedRef,
		activeMessage: mailbox.activeMessage,
		setActiveMessage: mailbox.setActiveMessage,
		setDetailError: mailbox.setDetailError,
		messages: mailbox.messages,
		setMessages: mailbox.setMessages,
		setFolders: mailbox.setFolders,
		setTotalMessages: mailbox.setTotalMessages,
		selectedUids: mailbox.selectedUids,
		setSelectedUids: mailbox.setSelectedUids,
		detailCacheRef: mailbox.detailCacheRef,
		handleRefresh: mailbox.handleRefresh,
	});

	const { isComposeOpen, composeInitial, handleReply, handleOpenCompose, closeCompose } =
		useMailCompose(mailbox.activeMessage, mailbox.userEmail);

	useAppCommand('mail' as AppID, (cmd) => {
		if (cmd === 'mail-compose') handleOpenCompose();
		if (cmd === 'mail-refresh') mailbox.handleRefresh();
	});

	if (!isAdmin) return <MailUnauthorizedState />;

	if (mailbox.error && mailbox.folders.length === 0 && !mailbox.isLoadingFolders) {
		return (
			<MailConnectionErrorState
				error={mailbox.error}
				outbox={outboxState.outbox}
				outboxOpen={outboxState.outboxOpen}
				setOutboxOpen={outboxState.setOutboxOpen}
				outboxBusyId={outboxState.outboxBusyId}
				onRefresh={mailbox.handleRefresh}
				onOutboxAction={(id, action) => void outboxState.handleOutboxAction(id, action)}
			/>
		);
	}

	const activeFolderTitle = activeFolderObj ? getFolderDisplayName(activeFolderObj, t) : t('mailFolderInbox');
	const retryDetail = () => {
		if (mailbox.selectedRef) {
			mailbox.detailCacheRef.current.delete(`${mailbox.selectedRef.folder}:${mailbox.selectedRef.uid}`);
			mailbox.setDetailReloadToken((n) => n + 1);
		}
	};

	const handleOutboxAction = (id: string, action: 'approve' | 'reject') =>
		void outboxState.handleOutboxAction(id, action);

	if (isMobile) {
		return (
			<>
				<MailMobileView
					folders={mailbox.folders}
					activeFolder={mailbox.activeFolder}
					onSelectFolder={mailbox.handleSelectFolder}
					messages={mailbox.messages}
					totalMessages={mailbox.totalMessages}
					page={mailbox.page}
					pageSize={mailbox.pageSize}
					onPageChange={mailbox.setPage}
					selectedUid={mailbox.selectedRef?.uid ?? null}
					onSelectMessage={mailbox.handleSelectMessage}
					onDeselectMessage={() => { mailbox.setSelectedRef(null); mailbox.setActiveMessage(null); }}
					activeMessage={mailbox.activeMessage}
					isLoadingList={mailbox.isLoadingList}
					isLoadingDetail={mailbox.isLoadingDetail}
					detailError={mailbox.detailError}
					onRetryDetail={retryDetail}
					searchQuery={mailbox.searchQuery}
					onSearchChange={mailbox.setSearchQuery}
					onRefresh={mailbox.handleRefresh}
					onToggleStar={actions.handleToggleStar}
					onToggleRead={actions.handleToggleRead}
					onTrash={actions.handleTrash}
					onRestore={actions.handleRestore}
					isTrashFolder={isTrashFolder}
					userEmail={mailbox.userEmail}
					onOpenCompose={handleOpenCompose}
					onReply={handleReply}
					isComposeOpen={isComposeOpen}
					onCloseCompose={closeCompose}
					composeInitial={composeInitial}
					onSendSuccess={mailbox.handleRefresh}
					selectedUids={mailbox.selectedUids}
					onToggleSelectUid={actions.handleToggleSelectUid}
					onSelectAll={actions.handleSelectAll}
					onDeselectAll={actions.handleDeselectAll}
					onBatchTrash={actions.handleBatchTrash}
					onBatchToggleRead={actions.handleBatchToggleRead}
					onEmptyTrash={actions.handleEmptyTrash}
				/>
				<MailOutboxPrompt
					variant="mobile"
					outbox={outboxState.outbox}
					outboxOpen={outboxState.outboxOpen}
					setOutboxOpen={outboxState.setOutboxOpen}
					outboxBusyId={outboxState.outboxBusyId}
					onOutboxAction={handleOutboxAction}
				/>
			</>
		);
	}

	return (
		<div className={styles.container}>
			<MailSidebar
				folders={mailbox.folders}
				activeFolder={mailbox.activeFolder}
				onSelectFolder={mailbox.handleSelectFolder}
				onOpenCompose={handleOpenCompose}
				userEmail={mailbox.userEmail}
				isLoading={mailbox.isLoadingFolders || mailbox.isLoadingList}
				onRefresh={mailbox.handleRefresh}
			/>
			<MailList
				folderTitle={activeFolderTitle}
				messages={mailbox.messages}
				selectedUid={mailbox.selectedRef?.uid ?? null}
				onSelectMessage={mailbox.handleSelectMessage}
				searchQuery={mailbox.searchQuery}
				onSearchChange={mailbox.setSearchQuery}
				isLoading={mailbox.isLoadingList}
				onRefresh={mailbox.handleRefresh}
				page={mailbox.page}
				pageSize={mailbox.pageSize}
				total={mailbox.totalMessages}
				selectedUids={mailbox.selectedUids}
				onToggleSelectUid={actions.handleToggleSelectUid}
				onSelectAll={actions.handleSelectAll}
				onDeselectAll={actions.handleDeselectAll}
				onBatchTrash={actions.handleBatchTrash}
				onBatchToggleRead={actions.handleBatchToggleRead}
				onToggleStar={actions.toggleStarForMessage}
				onToggleRead={actions.toggleReadForMessage}
				isTrashFolder={isTrashFolder}
				onEmptyTrash={actions.handleEmptyTrash}
				onPageChange={(nextPage) => {
					mailbox.setSelectedRef(null);
					mailbox.setActiveMessage(null);
					mailbox.setSelectedUids(new Set());
					mailbox.setPage(nextPage);
				}}
			/>
			<MailDetail
				message={mailbox.activeMessage}
				isLoading={mailbox.isLoadingDetail}
				error={mailbox.detailError}
				onRetry={retryDetail}
				onReply={handleReply}
				onToggleStar={actions.handleToggleStar}
				onToggleRead={actions.handleToggleRead}
				onTrash={actions.handleTrash}
				onRestore={isTrashFolder ? actions.handleRestore : undefined}
				isTrashFolder={isTrashFolder}
			/>
			<MailComposeModal
				isOpen={isComposeOpen}
				onClose={closeCompose}
				onSendSuccess={mailbox.handleRefresh}
				initial={composeInitial}
			/>
			<MailOutboxPrompt
				variant="desktop"
				outbox={outboxState.outbox}
				outboxOpen={outboxState.outboxOpen}
				setOutboxOpen={outboxState.setOutboxOpen}
				outboxBusyId={outboxState.outboxBusyId}
				onOutboxAction={handleOutboxAction}
			/>
		</div>
	);
};

