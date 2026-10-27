'use client';

import React from 'react';
import {
	ChevronLeft,
	Search,
	X,
	Plus,
	Pin,
	Trash2,
	StickyNote,
	CheckSquare,
	List,
	Bold,
	Italic,
	Loader2,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { useMobileSubView } from '@/lib/client/useMobileSubView';
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
	notes,
	folders,
	activeFolderId,
	selectedNoteId,
	activeNote,
	searchQuery,
	syncStatus,
	pinnedNotes,
	regularNotes,
	filteredNotes,
	colors,
	onSelectNote,
	onSelectFolder,
	onSearchChange,
	onCreateNote,
	onDeleteNote,
	onTogglePin,
	onUpdateTitle,
	onUpdateBody,
	titleInputRef,
	textareaRef,
}: NotesMobileViewProps) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();

	const isEditing = Boolean(selectedNoteId && activeNote);
	useMobileSubView(isEditing);

	const locale = language === 'tr' ? 'tr-TR' : 'en-US';

	const formatNoteDate = (timestamp: number) => {
		const date = new Date(timestamp);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		if (isToday) {
			return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
		}
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
		if (diffDays === 1) return t('notesYesterday');
		if (diffDays < 7) {
			return date.toLocaleDateString(locale, { weekday: 'short' });
		}
		return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
	};

	const getPreviewSnippet = (body: string) => {
		if (!body || !body.trim()) return t('notesNoExtraText');
		const clean = body
			.replace(/^#+\s+/gm, '')
			.replace(/\[\s*x?\s*\]/gi, '')
			.replace(/[-*]\s+/gm, '')
			.trim();
		return clean.slice(0, 80) || t('notesNoExtraText');
	};

	// --------------------------------------------------------------------------
	// Screen 2: Note Editor View (when a note is selected)
	// --------------------------------------------------------------------------
	if (isEditing && activeNote) {
		const insertMarkdown = (prefix: string, suffix = '') => {
			playSystemSound();
			const el = textareaRef.current;
			if (!el) {
				onUpdateBody(`${activeNote.body}${prefix}${suffix}`);
				return;
			}
			const start = el.selectionStart;
			const end = el.selectionEnd;
			const selected = activeNote.body.substring(start, end);
			const replacement = `${prefix}${selected}${suffix}`;
			const newBody = activeNote.body.substring(0, start) + replacement + activeNote.body.substring(end);
			onUpdateBody(newBody);
			setTimeout(() => {
				el.focus();
				el.setSelectionRange(start + prefix.length, end + prefix.length);
			}, 30);
		};

		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					height: '100%',
					width: '100%',
					background: colors.editorBg,
					color: colors.editorText,
					overflow: 'hidden',
				}}
			>
				{/* iOS Style Mobile Header */}
				<div
					style={{
						height: '50px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '0 12px',
						background: colors.toolbarBg,
						borderBottom: `1px solid ${colors.toolbarBorder}`,
						backdropFilter: 'blur(20px)',
						WebkitBackdropFilter: 'blur(20px)',
						flexShrink: 0,
						zIndex: 10,
					}}
				>
					<button
						type="button"
						onClick={() => {
							playSystemSound();
							onSelectNote(null);
						}}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '4px',
							background: 'transparent',
							border: 'none',
							color: 'var(--accent)',
							fontSize: '15px',
							fontWeight: 600,
							cursor: 'pointer',
							padding: '6px 4px',
						}}
					>
						<ChevronLeft size={20} />
						<span>{t('notesFoldersSection') || 'Notlar'}</span>
					</button>

					<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						{syncStatus === 'saving' ? (
							<span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
								<Loader2 size={12} className="spin-animation" />
								<span>{t('notesSavingStatus')}</span>
							</span>
						) : (
							<span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
								{formatNoteDate(activeNote.updatedAt)}
							</span>
						)}
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
						<button
							type="button"
							onClick={() => onTogglePin(activeNote.id)}
							title={t('notesPinnedLabel')}
							style={{
								background: 'transparent',
								border: 'none',
								color: activeNote.isPinned ? '#ffcc00' : 'var(--text-muted)',
								cursor: 'pointer',
								padding: '8px',
								display: 'grid',
								placeItems: 'center',
							}}
						>
							<Pin size={17} fill={activeNote.isPinned ? '#ffcc00' : 'none'} />
						</button>

						<button
							type="button"
							onClick={() => {
								onDeleteNote(activeNote.id);
								onSelectNote(null);
							}}
							title={t('delete')}
							style={{
								background: 'transparent',
								border: 'none',
								color: 'var(--text-muted)',
								cursor: 'pointer',
								padding: '8px',
								display: 'grid',
								placeItems: 'center',
							}}
						>
							<Trash2 size={17} />
						</button>

						<button
							type="button"
							onClick={() => {
								playSystemSound();
								onSelectNote(null);
							}}
							style={{
								background: 'var(--accent)',
								border: 'none',
								borderRadius: '16px',
								padding: '4px 12px',
								color: '#fff',
								fontSize: '13px',
								fontWeight: 600,
								cursor: 'pointer',
								marginLeft: '4px',
							}}
						>
							{t('done') || 'Bitti'}
						</button>
					</div>
				</div>

				{/* Note Title Input */}
				<div style={{ padding: '16px 16px 8px 16px' }}>
					<input
						ref={titleInputRef}
						type="text"
						placeholder={t('notesTitleInputPlaceholder')}
						value={activeNote.title}
						onChange={(e) => onUpdateTitle(e.target.value)}
						style={{
							width: '100%',
							background: 'transparent',
							border: 'none',
							outline: 'none',
							color: colors.editorTitleText,
							fontSize: '22px',
							fontWeight: 700,
							lineHeight: 1.25,
						}}
					/>
				</div>

				{/* Quick Formatting Bar */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '6px 16px',
						borderBottom: `1px solid ${colors.borderSubtle}`,
						background: 'rgba(255, 255, 255, 0.02)',
					}}
				>
					<button
						type="button"
						onClick={() => insertMarkdown('**', '**')}
						style={{
							background: 'rgba(255, 255, 255, 0.06)',
							border: 'none',
							borderRadius: '6px',
							padding: '5px 8px',
							color: 'inherit',
							cursor: 'pointer',
							display: 'inline-flex',
							alignItems: 'center',
						}}
						title={t('notesBold')}
					>
						<Bold size={14} />
					</button>

					<button
						type="button"
						onClick={() => insertMarkdown('*', '*')}
						style={{
							background: 'rgba(255, 255, 255, 0.06)',
							border: 'none',
							borderRadius: '6px',
							padding: '5px 8px',
							color: 'inherit',
							cursor: 'pointer',
							display: 'inline-flex',
							alignItems: 'center',
						}}
						title={t('notesItalic')}
					>
						<Italic size={14} />
					</button>

					<button
						type="button"
						onClick={() => insertMarkdown('\n- [ ] ')}
						style={{
							background: 'rgba(255, 255, 255, 0.06)',
							border: 'none',
							borderRadius: '6px',
							padding: '5px 8px',
							color: 'inherit',
							cursor: 'pointer',
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							fontSize: '12px',
						}}
						title={t('notesChecklist')}
					>
						<CheckSquare size={14} />
					</button>

					<button
						type="button"
						onClick={() => insertMarkdown('\n- ')}
						style={{
							background: 'rgba(255, 255, 255, 0.06)',
							border: 'none',
							borderRadius: '6px',
							padding: '5px 8px',
							color: 'inherit',
							cursor: 'pointer',
							display: 'inline-flex',
							alignItems: 'center',
						}}
						title={t('notesBulletList')}
					>
						<List size={14} />
					</button>
				</div>

				{/* Note Body Textarea */}
				<div style={{ flex: 1, minHeight: 0, padding: '12px 16px 24px 16px', display: 'flex' }}>
					<textarea
						ref={textareaRef}
						placeholder={t('notesBodyInputPlaceholder')}
						value={activeNote.body}
						onChange={(e) => onUpdateBody(e.target.value)}
						style={{
							flex: 1,
							width: '100%',
							background: 'transparent',
							border: 'none',
							outline: 'none',
							resize: 'none',
							color: colors.editorText,
							fontSize: '15px',
							lineHeight: 1.6,
							fontFamily: 'inherit',
						}}
					/>
				</div>
			</div>
		);
	}

	// --------------------------------------------------------------------------
	// Screen 1: Notes List View (Default)
	// --------------------------------------------------------------------------
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
			{/* Folder Chips Strip (Swipeable, No Scrollbar) */}
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
							onClick={() => {
								playSystemSound();
								onSelectFolder(folder.id);
							}}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								padding: '6px 14px',
								borderRadius: '20px',
								fontSize: '12.5px',
								fontWeight: isActive ? 700 : 500,
								border: isActive
									? '1px solid var(--accent-border)'
									: '1px solid rgba(255, 255, 255, 0.08)',
								background: isActive ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.04)',
								color: isActive ? 'var(--accent)' : 'inherit',
								cursor: 'pointer',
								whiteSpace: 'nowrap',
								flexShrink: 0,
								transition: 'all 120ms ease',
							}}
						>
							<span>{folder.name}</span>
							<span style={{ fontSize: '11px', opacity: 0.65 }}>({count})</span>
						</button>
					);
				})}
			</div>

			{/* Search Bar */}
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
						style={{
							flex: 1,
							background: 'transparent',
							border: 'none',
							outline: 'none',
							color: 'inherit',
							fontSize: '13px',
						}}
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

			{/* Notes List Content */}
			<div
				style={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					WebkitOverflowScrolling: 'touch',
					padding: '0 16px 80px 16px',
				}}
			>
				{filteredNotes.length === 0 ? (
					<div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.55 }}>
						<StickyNote size={44} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
						<div style={{ fontSize: '15px', fontWeight: 600 }}>
							{searchQuery ? t('notesNoNotesFound') : t('notesFolderEmpty')}
						</div>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{/* Pinned Section */}
						{pinnedNotes.length > 0 && (
							<>
								<div
									style={{
										fontSize: '11.5px',
										fontWeight: 700,
										textTransform: 'uppercase',
										letterSpacing: '0.5px',
										color: 'var(--text-muted)',
										padding: '6px 4px 2px 4px',
									}}
								>
									{t('notesPinnedLabel')}
								</div>
								{pinnedNotes.map((note) => (
									<div
										key={note.id}
										onClick={() => {
											playSystemSound();
											onSelectNote(note.id);
										}}
										style={{
											background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
											border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
											borderRadius: '12px',
											padding: '12px 14px',
											cursor: 'pointer',
											transition: 'all 120ms ease',
										}}
									>
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
											<span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
												{note.title || t('notesUntitledNote')}
											</span>
											<Pin size={13} color="#ffcc00" fill="#ffcc00" style={{ flexShrink: 0 }} />
										</div>
										<div
											style={{
												display: 'flex',
												alignItems: 'baseline',
												gap: '8px',
												marginTop: '4px',
												fontSize: '12.5px',
												color: 'var(--text-secondary)',
											}}
										>
											<span style={{ fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
												{formatNoteDate(note.updatedAt)}
											</span>
											<span
												style={{
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
													flex: 1,
												}}
											>
												{getPreviewSnippet(note.body)}
											</span>
										</div>
									</div>
								))}
							</>
						)}

						{/* Regular Section */}
						{regularNotes.length > 0 && (
							<>
								{pinnedNotes.length > 0 && (
									<div
										style={{
											fontSize: '11.5px',
											fontWeight: 700,
											textTransform: 'uppercase',
											letterSpacing: '0.5px',
											color: 'var(--text-muted)',
											padding: '10px 4px 2px 4px',
										}}
									>
										{t('notesNotesLabel')}
									</div>
								)}
								{regularNotes.map((note) => (
									<div
										key={note.id}
										onClick={() => {
											playSystemSound();
											onSelectNote(note.id);
										}}
										style={{
											background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
											border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
											borderRadius: '12px',
											padding: '12px 14px',
											cursor: 'pointer',
											transition: 'all 120ms ease',
										}}
									>
										<div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
											{note.title || t('notesUntitledNote')}
										</div>
										<div
											style={{
												display: 'flex',
												alignItems: 'baseline',
												gap: '8px',
												marginTop: '4px',
												fontSize: '12.5px',
												color: 'var(--text-secondary)',
											}}
										>
											<span style={{ fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
												{formatNoteDate(note.updatedAt)}
											</span>
											<span
												style={{
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
													flex: 1,
												}}
											>
												{getPreviewSnippet(note.body)}
											</span>
										</div>
									</div>
								))}
							</>
						)}
					</div>
				)}
			</div>

			{/* Floating Action Button (New Note) */}
			{activeFolderId !== 'trash' && (
				<div
					style={{
						position: 'absolute',
						bottom: '20px',
						right: '20px',
						zIndex: 50,
					}}
				>
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
							boxShadow: '0 8px 24px rgba(0, 122, 255, 0.45)',
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
