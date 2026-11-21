'use client';

import React from 'react';
import { Search, X, Plus, StickyNote } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
import { NotesMobileEditor } from './mobile/NotesMobileEditor';
import { NotesMobileNoteCard } from './mobile/NotesMobileNoteCard';
import type { AppleNote, NoteColors, NoteFolder } from '../types';

export interface NotesMobileViewProps {
	notes: AppleNote[];
	folders: NoteFolder[];
	activeFolderId: string;
	selectedNoteId: string | null;
	activeNote: AppleNote | null;
	searchQuery: string;
	syncStatus: 'saved' | 'saving' | 'offline';
	pinnedNotes: AppleNote[];
	regularNotes: AppleNote[];
	filteredNotes: AppleNote[];
	colors: NoteColors;
	onSelectNote: (id: string | null) => void;
	onSelectFolder: (id: string) => void;
	onSearchChange: (q: string) => void;
	onCreateNote: () => void;
	onDeleteNote: (id: string) => void;
	onTogglePin: (id: string) => void;
	onUpdateTitle: (title: string) => void;
	onUpdateBody: (body: string) => void;
	titleInputRef: React.RefObject<HTMLInputElement | null>;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function NotesMobileView({
	notes, folders, activeFolderId, selectedNoteId, activeNote, searchQuery, syncStatus,
	pinnedNotes, regularNotes, filteredNotes, colors, onSelectNote, onSelectFolder,
	onSearchChange, onCreateNote, onDeleteNote, onTogglePin, onUpdateTitle, onUpdateBody,
	titleInputRef, textareaRef,
}: NotesMobileViewProps) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const isEditing = Boolean(selectedNoteId && activeNote);
	useMobileSubView(isEditing);

	if (isEditing && activeNote) {
		return (
			<NotesMobileEditor
				activeNote={activeNote}
				syncStatus={syncStatus}
				colors={colors}
				titleInputRef={titleInputRef}
				textareaRef={textareaRef}
				onBack={() => onSelectNote(null)}
				onDeleteNote={onDeleteNote}
				onTogglePin={onTogglePin}
				onUpdateTitle={onUpdateTitle}
				onUpdateBody={onUpdateBody}
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
				overflow: 'hidden',
				position: 'relative',
			}}
		>
			<div
				className="no-scrollbar"
				style={{
					display: 'flex',
					gap: '8px',
					padding: '12px 16px 6px 16px',
					overflowX: 'auto',
					scrollbarWidth: 'none',
					msOverflowStyle: 'none',
					WebkitOverflowScrolling: 'touch',
					flexShrink: 0,
				}}
			>
				{folders.map((folder) => {
					const isActive = activeFolderId === folder.id;
					const count =
						folder.id === 'all'
							? notes.filter((n) => !n.isDeleted).length
							: folder.id === 'trash'
							? notes.filter((n) => n.isDeleted).length
							: notes.filter((n) => n.folderId === folder.id && !n.isDeleted).length;
					return (
						<button
							key={folder.id}
							type="button"
							onClick={() => { playSystemSound(); onSelectFolder(folder.id); }}
							style={{
								display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
								borderRadius: '20px', fontSize: '12.5px', fontWeight: isActive ? 700 : 500,
								border: isActive ? '1px solid var(--accent-border)' : '1px solid rgba(255, 255, 255, 0.08)',
								background: isActive ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.04)',
								color: isActive ? 'var(--accent)' : 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 120ms ease',
							}}
						>
							<span>{folder.name}</span>
							<span style={{ fontSize: '11px', opacity: 0.65 }}>({count})</span>
						</button>
					);
				})}
			</div>

			<div style={{ padding: '8px 16px 12px 16px', flexShrink: 0 }}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						background: colors.searchBg,
						border: `1px solid ${colors.searchBorder}`,
						borderRadius: '10px',
						padding: '8px 12px',
					}}
				>
					<Search size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
					<input
						type="text"
						placeholder={t('notesSearchInput')}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: '13px' }}
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => onSearchChange('')}
							style={{
								background: 'transparent',
								border: 'none',
								color: 'inherit',
								opacity: 0.6,
								cursor: 'pointer',
								padding: 0,
								display: 'grid',
								placeItems: 'center',
							}}
						>
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			<div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 80px 16px' }}>
				{filteredNotes.length === 0 ? (
					<div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.55 }}>
						<StickyNote size={44} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
						<div style={{ fontSize: '15px', fontWeight: 600 }}>{searchQuery ? t('notesNoNotesFound') : t('notesFolderEmpty')}</div>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{pinnedNotes.length > 0 && (
							<>
								<div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', padding: '6px 4px 2px 4px' }}>
									{t('notesPinnedLabel')}
								</div>
								{pinnedNotes.map((note) => (
									<NotesMobileNoteCard key={note.id} note={note} pinned onClick={() => { playSystemSound(); onSelectNote(note.id); }} />
								))}
							</>
						)}
						{regularNotes.length > 0 && (
							<>
								{pinnedNotes.length > 0 && (
									<div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', padding: '10px 4px 2px 4px' }}>
										{t('notesNotesLabel')}
									</div>
								)}
								{regularNotes.map((note) => (
									<NotesMobileNoteCard key={note.id} note={note} onClick={() => { playSystemSound(); onSelectNote(note.id); }} />
								))}
							</>
						)}
					</div>
				)}
			</div>

			{activeFolderId !== 'trash' && (
				<div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 50 }}>
					<button
						type="button"
						onClick={onCreateNote}
						title={t('notesNewNoteBtn')}
						style={{
							width: '54px',
							height: '54px',
							borderRadius: '27px',
							background: 'var(--accent)',
							color: '#fff',
							border: 'none',
							boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 45%, transparent)',
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
							transition: 'transform 120ms ease',
						}}
					>
						<Plus size={26} strokeWidth={2.4} />
					</button>
				</div>
			)}
		</div>
	);
}
