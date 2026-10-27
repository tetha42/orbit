'use client';

import React from 'react';
import {
	PanelLeft,
	List,
	LayoutGrid,
	Trash2,
	Heading1,
	Heading2,
	Bold,
	Italic,
	Strikethrough,
	CheckSquare,
	ListOrdered,
	Table,
	Code,
	Quote,
	Pin,
	PinOff,
	Share2,
	Eye,
	Edit3,
	SquarePen,
	Copy,
	Check,
	Download,
	Printer,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
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
	isSidebarOpen,
	onToggleSidebar,
	viewMode,
	onSetViewMode,
	activeNote,
	activeFolderId,
	editorMode,
	onSetEditorMode,
	showShareMenu,
	onToggleShareMenu,
	copied,
	colors,
	onDeleteActiveNote,
	onTogglePinActiveNote,
	onCreateNote,
	onInsertText,
	onInsertChecklist,
	onInsertTable,
	onCopyText,
	onDownloadMarkdown,
	onPrint,
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
			{/* Left Group */}
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

				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						background: colors.pillContainerBg,
						borderRadius: '6px',
						padding: '2px',
					}}
				>
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
							color: activeFolderId === 'trash' ? '#ef4444' : colors.appText,
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
						}}
					>
						<Trash2 size={16} />
					</button>
				)}
			</div>

			{/* Center Group: Formatting */}
			{activeNote && !activeNote.isDeleted && (
				<div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
					<button onClick={() => onInsertText('# ')} title={t('notesHeading1')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Heading1 size={15} />
					</button>
					<button onClick={() => onInsertText('## ')} title={t('notesHeading2')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Heading2 size={15} />
					</button>
					<button onClick={() => onInsertText('**', '**')} title={t('notesBold')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Bold size={15} />
					</button>
					<button onClick={() => onInsertText('*', '*')} title={t('notesItalic')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Italic size={15} />
					</button>
					<button onClick={() => onInsertText('~~', '~~')} title={t('notesStrikethrough')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Strikethrough size={15} />
					</button>
					<div style={{ width: '1px', height: '18px', background: colors.borderDivider, margin: '0 2px' }} />
					<button onClick={onInsertChecklist} title={t('notesChecklist')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.accentGold }}>
						<CheckSquare size={16} />
					</button>
					<button onClick={() => onInsertText('- ')} title={t('notesBulletList')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<List size={15} />
					</button>
					<button onClick={() => onInsertText('1. ')} title={t('notesNumberList')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<ListOrdered size={15} />
					</button>
					<button onClick={onInsertTable} title={t('notesTable')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Table size={15} />
					</button>
					<button onClick={() => onInsertText('```\n', '\n```')} title={t('notesCodeBlock')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Code size={15} />
					</button>
					<button onClick={() => onInsertText('> ')} title={t('notesQuote')} style={{ padding: '5px 7px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: colors.appText }}>
						<Quote size={15} />
					</button>
				</div>
			)}

			{/* Right Group */}
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
								background: activeNote.isPinned ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
								color: activeNote.isPinned ? colors.accentGold : colors.appText,
								cursor: 'pointer',
								display: 'grid',
								placeItems: 'center',
							}}
						>
							{activeNote.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
						</button>

						<div style={{ position: 'relative' }}>
							<button
								onClick={onToggleShareMenu}
								title={t('notesShareExport')}
								style={{
									padding: '6px',
									borderRadius: '6px',
									border: 'none',
									background: showShareMenu ? colors.btnActive : 'transparent',
									color: colors.appText,
									cursor: 'pointer',
									display: 'grid',
									placeItems: 'center',
								}}
							>
								<Share2 size={16} />
							</button>

							{showShareMenu && (
								<div
									style={{
										position: 'absolute',
										top: '32px',
										right: 0,
										width: '180px',
										background: colors.popoverBg,
										borderRadius: '8px',
										boxShadow: colors.popoverShadow,
										border: `1px solid ${colors.popoverBorder}`,
										padding: '4px',
										zIndex: 999,
										display: 'flex',
										flexDirection: 'column',
										gap: '2px',
									}}
								>
									<button
										onClick={onCopyText}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '8px',
											padding: '6px 10px',
											borderRadius: '6px',
											border: 'none',
											background: 'transparent',
											color: colors.appText,
											fontSize: '12.5px',
											cursor: 'pointer',
											textAlign: 'left',
										}}
									>
										{copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
										<span>{copied ? t('dlgCopied') : t('decisionsCopyText')}</span>
									</button>
									<button
										onClick={onDownloadMarkdown}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '8px',
											padding: '6px 10px',
											borderRadius: '6px',
											border: 'none',
											background: 'transparent',
											color: colors.appText,
											fontSize: '12.5px',
											cursor: 'pointer',
											textAlign: 'left',
										}}
									>
										<Download size={14} />
										<span>{t('notesDownloadMd')}</span>
									</button>
									<button
										onClick={onPrint}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '8px',
											padding: '6px 10px',
											borderRadius: '6px',
											border: 'none',
											background: 'transparent',
											color: colors.appText,
											fontSize: '12.5px',
											cursor: 'pointer',
											textAlign: 'left',
										}}
									>
										<Printer size={14} />
										<span>{t('notesPrintPdf')}</span>
									</button>
								</div>
							)}
						</div>

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
