'use client';

import React from 'react';
import { Folder, Check, Loader2, StickyNote, SquarePen, ImagePlus, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import notesContract from '../notes.contract.json';
import { useNoteImageUpload } from '../hooks/useNoteImageUpload';
import { getFolderDisplayName } from '../utils/noteHelpers';
import { NoteMarkdownPreview } from './NoteMarkdownPreview';
import type { AppleNote, NoteFolder, NoteColors } from '../types';

interface NoteEditorProps {
	activeNote: AppleNote | null;
	isLoading: boolean;
	editorMode: 'edit' | 'preview';
	syncStatus: 'saved' | 'saving' | 'offline';
	folders: NoteFolder[];
	folderSelectMenuOpen: boolean;
	colors: NoteColors;
	titleInputRef: React.RefObject<HTMLInputElement | null>;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	onToggleFolderMenu: () => void;
	onMoveFolder: (noteId: string, folderId: string) => void;
	onUpdateTitle: (title: string) => void;
	onUpdateBody: (body: string) => void;
	onToggleChecklistItem: (index: number) => void;
	onCreateNote: () => void;
}

export function NoteEditor({
	activeNote, isLoading, editorMode, syncStatus, folders, folderSelectMenuOpen, colors,
	titleInputRef, textareaRef, onToggleFolderMenu, onMoveFolder, onUpdateTitle,
	onUpdateBody, onToggleChecklistItem, onCreateNote,
}: NoteEditorProps) {
	const { t, language } = useI18n();
	const {
		fileInputRef, isUploading, isDraggingImage, uploadError, clearUploadError,
		openFilePicker, handleFileInputChange, handlePaste, handleDragOver, handleDragLeave, handleDrop,
	} = useNoteImageUpload({ activeNote, syncStatus, textareaRef, onUpdateBody });

	const formatHeaderDate = (timestamp: number) =>
		new Date(timestamp).toLocaleDateString(language, {
			day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
		});

	const wordCount = activeNote?.body.trim() ? activeNote.body.trim().split(/\s+/).length : 0;
	const charCount = activeNote?.body.length || 0;

	if (!activeNote) {
		if (isLoading) {
			return (
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: colors.textSecondary }}>
					<Loader2 className="animate-spin" size={28} color={colors.accentGold} />
					<div style={{ fontSize: '13px' }}>{t('notesLoading')}</div>
				</div>
			);
		}
		return (
			<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: colors.textSecondary }}>
				<div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-subtle)', display: 'grid', placeItems: 'center', color: colors.accentGold }}>
					<StickyNote size={28} />
				</div>
				<div style={{ fontSize: '15px', fontWeight: 600, color: colors.appText }}>{t('notesNoNoteSelected')}</div>
				<div style={{ fontSize: '13px', color: colors.textSecondary }}>{t('notesSelectNoteHint')}</div>
				<button
					onClick={onCreateNote}
					style={{
						display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: 'none',
						background: colors.accentGold, color: 'var(--accent-contrast, #ffffff)', fontSize: '12.5px', fontWeight: 600,
						cursor: 'pointer', boxShadow: 'var(--accent-glow)',
					}}
				>
					<SquarePen size={14} />
					<span>{t('notesCreateFirst')}</span>
				</button>
			</div>
		);
	}

	const headerBarStyle: React.CSSProperties = {
		display: 'flex', alignItems: 'center', justifyContent: 'space-between',
		padding: '8px 24px', borderBottom: `1px solid ${colors.borderSubtle}`,
		fontSize: '11px', color: colors.metaBarText,
	};
	const folderBtnStyle: React.CSSProperties = {
		display: 'flex', alignItems: 'center', gap: '5px', border: 'none',
		background: 'transparent', color: colors.appText, cursor: 'pointer',
		fontSize: '11.5px', fontWeight: 500,
	};
	const popoverStyle: React.CSSProperties = {
		position: 'absolute', top: '24px', left: 0, width: '160px',
		background: colors.popoverBg, borderRadius: '8px', boxShadow: colors.popoverShadow,
		border: `1px solid ${colors.popoverBorder}`, padding: '4px', zIndex: 999,
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
			<div style={headerBarStyle}>
				<div style={{ position: 'relative' }}>
					<button onClick={onToggleFolderMenu} style={folderBtnStyle}>
						<Folder size={12} color={colors.accentGold} />
						<span>{getFolderDisplayName(folders.find((f) => f.id === activeNote.folderId), t)}</span>
					</button>
					{folderSelectMenuOpen && (
						<div style={popoverStyle}>
							{folders.filter((f) => f.id !== 'all' && f.id !== 'trash').map((fld) => (
								<button
									key={fld.id}
									onClick={() => onMoveFolder(activeNote.id, fld.id)}
									style={{
										width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '5px', border: 'none',
										background: activeNote.folderId === fld.id ? colors.folderActiveBg : 'transparent',
										color: activeNote.folderId === fld.id ? colors.folderActiveText : colors.appText,
										fontSize: '12px', cursor: 'pointer', textAlign: 'left',
									}}
								>
									<span>{getFolderDisplayName(fld, t)}</span>
								</button>
							))}
						</div>
					)}
				</div>

				<div style={{ textAlign: 'center', fontWeight: 500 }}>{formatHeaderDate(activeNote.updatedAt)}</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{!activeNote.isDeleted && editorMode === 'edit' && (
						<>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png,image/jpeg,image/webp,image/gif"
								onChange={handleFileInputChange}
								style={{ display: 'none' }}
							/>
							<button
								type="button"
								onClick={openFilePicker}
								disabled={isUploading}
								title={t('notesUploadImage')}
								style={{
									display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px',
									border: `1px solid ${colors.borderSubtle}`, background: 'transparent', color: colors.appText,
									cursor: isUploading ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 500,
								}}
							>
								{isUploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} color={colors.accentGold} />}
								<span>{isUploading ? t('notesUploadingImage') : t('notesUploadImage')}</span>
							</button>
						</>
					)}
					<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
						{syncStatus === 'saved' && (<><Check size={11} color="var(--success)" /><span>{t('notesSavedCloud')}</span></>)}
						{syncStatus === 'saving' && (<><Loader2 size={11} className="animate-spin" color={colors.accentGold} /><span>{t('notesSavingStatus')}</span></>)}
						{syncStatus === 'offline' && <span>{t('notesOfflineStatus')}</span>}
					</div>
				</div>
			</div>

			{uploadError && (
				<div
					style={{
						margin: '8px 24px 0', padding: '6px 10px', borderRadius: '7px', fontSize: '12px', color: 'var(--danger)',
						background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
						display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
					}}
				>
					<span>{uploadError}</span>
					<button type="button" onClick={clearUploadError} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0 }}>
						<X size={13} />
					</button>
				</div>
			)}

			<div style={{ padding: '16px 24px 8px 24px' }}>
				<input
					ref={titleInputRef}
					type="text"
					value={activeNote.title}
					onChange={(e) => onUpdateTitle(e.target.value)}
					placeholder={t('notesTitleInputPlaceholder')}
					disabled={activeNote.isDeleted}
					style={{
						width: '100%', border: 'none', outline: 'none', background: 'transparent',
						fontSize: '22px', fontWeight: 700, color: colors.editorTitleText, letterSpacing: '-0.3px',
					}}
				/>
			</div>

			<div
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				style={{
					flex: 1, padding: '0 24px 16px 24px', overflowY: 'auto', position: 'relative',
					outline: isDraggingImage ? '2px dashed var(--accent)' : 'none', outlineOffset: '-8px', borderRadius: '8px',
				}}
			>
				{isDraggingImage && (
					<div
						style={{
							position: 'absolute', inset: '8px 24px 16px', borderRadius: '8px',
							background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
							display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 4,
							fontSize: '13px', fontWeight: 600, color: 'var(--accent)',
						}}
					>
						{t('notesDropImageHint')}
					</div>
				)}
				{editorMode === 'edit' ? (
					<textarea
						ref={textareaRef}
						value={activeNote.body}
						maxLength={notesContract.limits.maxNoteLength}
						onChange={(e) => onUpdateBody(e.target.value)}
						onPaste={handlePaste}
						placeholder={t('notesBodyInputPlaceholder')}
						disabled={activeNote.isDeleted}
						style={{
							width: '100%', height: '100%', minHeight: '200px', border: 'none', outline: 'none', background: 'transparent',
							color: colors.editorText, fontSize: '14.5px', lineHeight: 1.65, resize: 'none', fontFamily: 'inherit', caretColor: colors.accentGold,
						}}
					/>
				) : (
					<NoteMarkdownPreview body={activeNote.body} colors={colors} onToggleChecklistItem={onToggleChecklistItem} />
				)}
			</div>

			<div
				style={{
					display: 'flex', justifyContent: 'space-between', padding: '6px 24px',
					fontSize: '11px', color: colors.textSecondary, borderTop: `1px solid ${colors.borderSubtle}`,
				}}
			>
				<span>{fill(t('notesWordCount'), { words: wordCount, chars: charCount })}</span>
			</div>
		</div>
	);
}
