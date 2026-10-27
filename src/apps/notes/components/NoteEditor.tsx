'use client';

import React from 'react';
import { Folder, Check, Loader2, StickyNote, SquarePen } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
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
	activeNote,
	isLoading,
	editorMode,
	syncStatus,
	folders,
	folderSelectMenuOpen,
	colors,
	titleInputRef,
	textareaRef,
	onToggleFolderMenu,
	onMoveFolder,
	onUpdateTitle,
	onUpdateBody,
	onToggleChecklistItem,
	onCreateNote,
}: NoteEditorProps) {
	const { t, language } = useI18n();

	const formatHeaderDate = (timestamp: number) => {
		const date = new Date(timestamp);
		const locale = language === 'tr' ? 'tr-TR' : 'en-US';
		return date.toLocaleDateString(locale, {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const getFolderName = (fld?: NoteFolder | null) => {
		if (!fld) return t('notesFolderQuick');
		if (!fld.isSystem) return fld.name;
		switch (fld.id) {
			case 'all': return t('notesFolderAll');
			case 'quick': return t('notesFolderQuick');
			case 'club': return t('notesFolderClub');
			case 'teknofest': return t('notesFolderTeknofest');
			case 'workshops': return t('notesFolderWorkshops');
			case 'personal': return t('notesFolderPersonal');
			case 'trash': return t('notesFolderTrash');
			default: return fld.name;
		}
	};

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
					style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: 'none', background: colors.accentGold, color: 'var(--accent-contrast, #ffffff)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--accent-glow)' }}
				>
					<SquarePen size={14} />
					<span>{t('notesCreateFirst')}</span>
				</button>
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '8px 24px',
					borderBottom: `1px solid ${colors.borderSubtle}`,
					fontSize: '11px',
					color: colors.metaBarText,
				}}
			>
				<div style={{ position: 'relative' }}>
					<button
						onClick={onToggleFolderMenu}
						style={{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', background: 'transparent', color: colors.appText, cursor: 'pointer', fontSize: '11.5px', fontWeight: 500 }}
					>
						<Folder size={12} color={colors.accentGold} />
						<span>{getFolderName(folders.find((f) => f.id === activeNote.folderId))}</span>
					</button>

					{folderSelectMenuOpen && (
						<div
							style={{
								position: 'absolute',
								top: '24px',
								left: 0,
								width: '160px',
								background: colors.popoverBg,
								borderRadius: '8px',
								boxShadow: colors.popoverShadow,
								border: `1px solid ${colors.popoverBorder}`,
								padding: '4px',
								zIndex: 999,
							}}
						>
							{folders
								.filter((f) => f.id !== 'all' && f.id !== 'trash')
								.map((fld) => (
									<button
										key={fld.id}
										onClick={() => onMoveFolder(activeNote.id, fld.id)}
										style={{
											width: '100%',
											display: 'flex',
											alignItems: 'center',
											gap: '6px',
											padding: '6px 8px',
											borderRadius: '5px',
											border: 'none',
											background: activeNote.folderId === fld.id ? colors.folderActiveBg : 'transparent',
											color: activeNote.folderId === fld.id ? colors.folderActiveText : colors.appText,
											fontSize: '12px',
											cursor: 'pointer',
											textAlign: 'left',
										}}
									>
										<span>{getFolderName(fld)}</span>
									</button>
								))}
						</div>
					)}
				</div>

				<div style={{ textAlign: 'center', fontWeight: 500 }}>
					{formatHeaderDate(activeNote.updatedAt)}
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
					{syncStatus === 'saved' && (
						<>
							<Check size={11} color="#10b981" />
							<span>{t('notesSavedCloud')}</span>
						</>
					)}
					{syncStatus === 'saving' && (
						<>
							<Loader2 size={11} className="animate-spin" color={colors.accentGold} />
							<span>{t('notesSavingStatus')}</span>
						</>
					)}
					{syncStatus === 'offline' && <span>{t('notesOfflineStatus')}</span>}
				</div>
			</div>

			<div style={{ padding: '16px 24px 8px 24px' }}>
				<input
					ref={titleInputRef}
					type="text"
					value={activeNote.title}
					onChange={(e) => onUpdateTitle(e.target.value)}
					placeholder={t('notesTitleInputPlaceholder')}
					disabled={activeNote.isDeleted}
					style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '22px', fontWeight: 700, color: colors.editorTitleText, letterSpacing: '-0.3px' }}
				/>
			</div>

			<div style={{ flex: 1, padding: '0 24px 16px 24px', overflowY: 'auto' }}>
				{editorMode === 'edit' ? (
					<textarea
						ref={textareaRef}
						value={activeNote.body}
						onChange={(e) => onUpdateBody(e.target.value)}
						placeholder={t('notesBodyInputPlaceholder')}
						disabled={activeNote.isDeleted}
						style={{ width: '100%', height: '100%', minHeight: '200px', border: 'none', outline: 'none', background: 'transparent', color: colors.editorText, fontSize: '14.5px', lineHeight: 1.65, resize: 'none', fontFamily: 'inherit', caretColor: colors.accentGold }}
					/>
				) : (
					<div style={{ fontSize: '14.5px', lineHeight: 1.65, color: colors.editorText }}>
						{activeNote.body.split('\n').map((line, idx) => {
							if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) {
								const isChecked = line.trim().startsWith('- [x]');
								const itemText = line.replace(/^- \[(x| )\]/, '').trim();
								return (
									<div key={idx} onClick={() => onToggleChecklistItem(idx)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', cursor: 'pointer' }}>
										<div style={{ width: '18px', height: '18px', borderRadius: '50%', border: isChecked ? 'none' : `1.8px solid var(--accent)`, background: isChecked ? colors.accentGold : 'transparent', display: 'grid', placeItems: 'center', color: 'var(--accent-contrast, #ffffff)', flexShrink: 0, transition: 'all 0.15s ease' }}>
											{isChecked && <Check size={11} strokeWidth={3} />}
										</div>
										<span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.45 : 1 }}>{itemText}</span>
									</div>
								);
							}
							if (line.startsWith('# ')) {
								return <h1 key={idx} style={{ fontSize: '18px', fontWeight: 700, margin: '14px 0 6px 0', color: colors.editorTitleText }}>{line.replace('# ', '')}</h1>;
							}
							if (line.startsWith('## ') || line.startsWith('### ')) {
								return <h2 key={idx} style={{ fontSize: '16px', fontWeight: 600, margin: '12px 0 4px 0', color: colors.editorTitleText }}>{line.replace(/^###? /, '')}</h2>;
							}
							if (line.startsWith('- ')) {
								return <li key={idx} style={{ marginLeft: '20px', padding: '2px 0' }}>{line.replace('- ', '')}</li>;
							}
							if (line.startsWith('|')) {
								return <div key={idx} style={{ fontFamily: 'monospace', fontSize: '13px', padding: '2px 6px', background: colors.tableBg, borderRadius: '4px', margin: '1px 0', color: colors.appText }}>{line}</div>;
							}
							if (!line.trim()) {
								return <div key={idx} style={{ height: '8px' }} />;
							}
							return <p key={idx} style={{ margin: '3px 0' }}>{line}</p>;
						})}
					</div>
				)}
			</div>

			<div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 24px', fontSize: '11px', color: colors.textSecondary, borderTop: `1px solid ${colors.borderSubtle}` }}>
				<span>{fill(t('notesWordCount'), { words: wordCount, chars: charCount })}</span>
			</div>
		</div>
	);
}
