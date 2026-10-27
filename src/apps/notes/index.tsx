'use client';

import React from 'react';
import { useTheme } from '@/core/theme';
import { useI18n } from '@/core/i18n';
import { useNotes } from './hooks/useNotes';
import { NotesToolbar } from './components/NotesToolbar';
import { SidebarFolders } from './components/SidebarFolders';
import { NotesList } from './components/NotesList';
import { NoteEditor } from './components/NoteEditor';
import { getNoteColors } from './types';
import { useIsMobile } from '@/lib/client/useClientValue';
import { NotesMobileView } from './components/NotesMobileView';

export function NotesApp() {
	const { t } = useI18n();
	const { isDark } = useTheme();
	const notesHook = useNotes();
	const colors = getNoteColors(isDark);
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<NotesMobileView
				notes={notesHook.notes}
				folders={notesHook.folders}
				activeFolderId={notesHook.activeFolderId}
				selectedNoteId={notesHook.selectedNoteId}
				activeNote={notesHook.activeNote}
				searchQuery={notesHook.searchQuery}
				syncStatus={notesHook.syncStatus}
				pinnedNotes={notesHook.pinnedNotes}
				regularNotes={notesHook.regularNotes}
				filteredNotes={notesHook.filteredNotes}
				colors={colors}
				onSelectNote={notesHook.setSelectedNoteId}
				onSelectFolder={notesHook.setActiveFolderId}
				onSearchChange={notesHook.setSearchQuery}
				onCreateNote={notesHook.handleCreateNote}
				onDeleteNote={notesHook.handleDeleteNote}
				onTogglePin={notesHook.handleTogglePin}
				onUpdateTitle={notesHook.handleUpdateTitle}
				onUpdateBody={notesHook.handleUpdateBody}
				titleInputRef={notesHook.titleInputRef}
				textareaRef={notesHook.textareaRef}
			/>
		);
	}

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				width: '100%',
				background: colors.appBg,
				color: colors.appText,
				fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif',
				userSelect: 'none',
				overflow: 'hidden',
			}}
		>
			<NotesToolbar
				isSidebarOpen={notesHook.isSidebarOpen}
				onToggleSidebar={() => notesHook.setIsSidebarOpen(!notesHook.isSidebarOpen)}
				viewMode={notesHook.viewMode}
				onSetViewMode={notesHook.setViewMode}
				activeNote={notesHook.activeNote}
				activeFolderId={notesHook.activeFolderId}
				editorMode={notesHook.editorMode}
				onSetEditorMode={notesHook.setEditorMode}
				showShareMenu={notesHook.showShareMenu}
				onToggleShareMenu={() => notesHook.setShowShareMenu(!notesHook.showShareMenu)}
				copied={notesHook.copied}
				colors={colors}
				onDeleteActiveNote={() => notesHook.activeNote && notesHook.handleDeleteNote(notesHook.activeNote.id)}
				onTogglePinActiveNote={() => notesHook.activeNote && notesHook.handleTogglePin(notesHook.activeNote.id)}
				onCreateNote={notesHook.handleCreateNote}
				onInsertText={notesHook.insertTextAtCursor}
				onInsertChecklist={() => notesHook.insertTextAtCursor('- [ ] ')}
				onInsertTable={() => notesHook.insertTextAtCursor(`\n| ${t('notesTableSampleHeader')} 1 | ${t('notesTableSampleHeader')} 2 | ${t('notesTableSampleHeader')} 3 |\n| --- | --- | --- |\n| ${t('notesTableSampleData')} 1 | ${t('notesTableSampleData')} 2 | ${t('notesTableSampleData')} 3 |\n| ${t('notesTableSampleData')} 4 | ${t('notesTableSampleData')} 5 | ${t('notesTableSampleData')} 6 |\n`)}
				onCopyText={notesHook.handleCopyText}
				onDownloadMarkdown={notesHook.handleDownloadMarkdown}
				onPrint={notesHook.handlePrint}
			/>

			<div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
				{notesHook.isSidebarOpen && (
					<SidebarFolders
						folders={notesHook.folders}
						notes={notesHook.notes}
						activeFolderId={notesHook.activeFolderId}
						showNewFolderModal={notesHook.showNewFolderModal}
						newFolderName={notesHook.newFolderName}
						colors={colors}
						onSelectFolder={notesHook.setActiveFolderId}
						onShowNewFolderModal={notesHook.setShowNewFolderModal}
						onChangeNewFolderName={notesHook.setNewFolderName}
						onCreateFolder={notesHook.handleCreateFolder}
						onDeleteFolder={notesHook.handleDeleteCustomFolder}
					/>
				)}

				<NotesList
					searchQuery={notesHook.searchQuery}
					onSearchChange={notesHook.setSearchQuery}
					activeFolderId={notesHook.activeFolderId}
					notes={notesHook.notes}
					filteredNotes={notesHook.filteredNotes}
					pinnedNotes={notesHook.pinnedNotes}
					regularNotes={notesHook.regularNotes}
					selectedNoteId={notesHook.selectedNoteId}
					viewMode={notesHook.viewMode}
					isLoading={notesHook.isLoading}
					colors={colors}
					onSelectNote={notesHook.setSelectedNoteId}
					onTogglePin={notesHook.handleTogglePin}
					onDeleteNote={notesHook.handleDeleteNote}
					onRestoreNote={notesHook.handleRestoreNote}
					onEmptyTrash={notesHook.handleEmptyTrash}
					onCreateNote={notesHook.handleCreateNote}
				/>

				<div style={{ flex: 1, height: '100%', background: colors.editorBg, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
					<NoteEditor
						activeNote={notesHook.activeNote}
						isLoading={notesHook.isLoading}
						editorMode={notesHook.editorMode}
						syncStatus={notesHook.syncStatus}
						folders={notesHook.folders}
						folderSelectMenuOpen={notesHook.folderSelectMenuOpen}
						colors={colors}
						titleInputRef={notesHook.titleInputRef}
						textareaRef={notesHook.textareaRef}
						onToggleFolderMenu={() => notesHook.setFolderSelectMenuOpen(!notesHook.folderSelectMenuOpen)}
						onMoveFolder={notesHook.handleMoveFolder}
						onUpdateTitle={notesHook.handleUpdateTitle}
						onUpdateBody={notesHook.handleUpdateBody}
						onToggleChecklistItem={notesHook.handleToggleChecklistItem}
						onCreateNote={notesHook.handleCreateNote}
					/>
				</div>
			</div>
		</div>
	);
}

export default NotesApp;
