'use client';

import React from 'react';
import { PanelLeft, List, LayoutGrid, Trash2, Pin, PinOff, Eye, Edit3, SquarePen } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { NotesFormattingBar } from './NotesFormattingBar';
import { NotesToolbarShareMenu } from './NotesToolbarShareMenu';
import type { AppleNote, NoteColors } from '../types';

interface NotesToolbarProps {
	isSidebarOpen: boolean;
	onToggleSidebar: () => void;
	viewMode: 'list' | 'grid';
	onSetViewMode: (mode: 'list' | 'grid') => void;
	activeNote: AppleNote | null;
	activeFolderId: string;
	editorMode: 'edit' | 'preview';
	onSetEditorMode: (mode: 'edit' | 'preview') => void;
	showShareMenu: boolean;
	onToggleShareMenu: () => void;
	copied: boolean;
	colors: NoteColors;
	onDeleteActiveNote: () => void;
	onTogglePinActiveNote: () => void;
	onCreateNote: () => void;
	onInsertText: (prefix: string, suffix?: string) => void;
	onInsertChecklist: () => void;
	onInsertTable: () => void;
	onCopyText: () => void;
	onDownloadMarkdown: () => void;
	onPrint: () => void;
}

export function NotesToolbar({
	isSidebarOpen, onToggleSidebar, viewMode, onSetViewMode, activeNote, activeFolderId,
	editorMode, onSetEditorMode, showShareMenu, onToggleShareMenu, copied, colors,
	onDeleteActiveNote, onTogglePinActiveNote, onCreateNote, onInsertText,
	onInsertChecklist, onInsertTable, onCopyText, onDownloadMarkdown, onPrint,
}: NotesToolbarProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				height: '44px',
				minHeight: '44px',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '0 12px',
				background: colors.toolbarBg,
				backdropFilter: 'var(--glass-blur)',
				borderBottom: `1px solid ${colors.toolbarBorder}`,
				gap: '8px',
				zIndex: 10,
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
				<button
					onClick={onToggleSidebar}
					title={t('notesToggleSidebar')}
					style={{
						padding: '6px',
						borderRadius: '6px',
						border: 'none',
						background: isSidebarOpen ? colors.btnActive : 'transparent',
						color: colors.appText,
						cursor: 'pointer',
						display: 'grid',
						placeItems: 'center',
					}}
				>
					<PanelLeft size={16} />
				</button>

				<div style={{ display: 'flex', alignItems: 'center', background: colors.pillContainerBg, borderRadius: '6px', padding: '2px' }}>
					<button
						onClick={() => onSetViewMode('list')}
						title={t('notesListView')}
						style={{
							padding: '4px 6px',
							borderRadius: '5px',
							border: 'none',
							background: viewMode === 'list' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
							boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
							color: colors.appText,
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
						}}
					>
						<List size={14} />
					</button>
					<button
						onClick={() => onSetViewMode('grid')}
						title={t('notesGridView')}
						style={{
							padding: '4px 6px',
							borderRadius: '5px',
							border: 'none',
							background: viewMode === 'grid' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
							boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
							color: colors.appText,
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
						}}
					>
						<LayoutGrid size={14} />
					</button>
				</div>

				{activeNote && (
					<button
						onClick={onDeleteActiveNote}
						title={activeFolderId === 'trash' ? t('notesDeletePermanent') : t('notesMoveToTrash')}
						style={{
							padding: '6px',
							borderRadius: '6px',
							border: 'none',
							background: 'transparent',
							color: activeFolderId === 'trash' ? 'var(--danger)' : colors.appText,
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
						}}
					>
						<Trash2 size={16} />
					</button>
				)}
			</div>

			{activeNote && !activeNote.isDeleted && (
				<NotesFormattingBar
					colors={colors}
					onInsertText={onInsertText}
					onInsertChecklist={onInsertChecklist}
					onInsertTable={onInsertTable}
				/>
			)}

			<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
				{activeNote && !activeNote.isDeleted && (
					<>
						<button
							onClick={onTogglePinActiveNote}
							title={activeNote.isPinned ? t('notesUnpin') : t('notesPin')}
							style={{
								padding: '6px',
								borderRadius: '6px',
								border: 'none',
								background: activeNote.isPinned ? 'color-mix(in srgb, var(--gold) 20%, transparent)' : 'transparent',
								color: activeNote.isPinned ? colors.accentGold : colors.appText,
								cursor: 'pointer',
								display: 'grid',
								placeItems: 'center',
							}}
						>
							{activeNote.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
						</button>

						<NotesToolbarShareMenu
							showShareMenu={showShareMenu}
							copied={copied}
							colors={colors}
							onToggleShareMenu={onToggleShareMenu}
							onCopyText={onCopyText}
							onDownloadMarkdown={onDownloadMarkdown}
							onPrint={onPrint}
						/>

						<button
							onClick={() => onSetEditorMode(editorMode === 'edit' ? 'preview' : 'edit')}
							title={editorMode === 'edit' ? t('notesPreviewMode') : t('notesEditMode')}
							style={{
								padding: '6px',
								borderRadius: '6px',
								border: 'none',
								background: editorMode === 'preview' ? colors.btnActive : 'transparent',
								color: colors.appText,
								cursor: 'pointer',
								display: 'grid',
								placeItems: 'center',
							}}
						>
							{editorMode === 'edit' ? <Eye size={16} /> : <Edit3 size={16} />}
						</button>
					</>
				)}

				<button
					onClick={onCreateNote}
					title={`${t('notesNewNoteBtn')} (⌘N)`}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '5px',
						padding: '5px 12px',
						borderRadius: '6px',
						border: 'none',
						background: colors.accentGold,
						color: '#000000',
						fontSize: '12px',
						fontWeight: 600,
						cursor: 'pointer',
						boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
					}}
				>
					<SquarePen size={14} />
					<span>{t('notesNewNoteBtn')}</span>
				</button>
			</div>
		</div>
	);
}
