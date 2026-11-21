'use client';

import React from 'react';
import { Search, X, Loader2, StickyNote, SquarePen } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatNoteDate } from '../utils/noteHelpers';
import { NotesListSection } from './NotesListSection';
import type { AppleNote, NoteColors } from '../types';

interface NotesListProps {
	searchQuery: string;
	onSearchChange: (q: string) => void;
	activeFolderId: string;
	notes: AppleNote[];
	filteredNotes: AppleNote[];
	pinnedNotes: AppleNote[];
	regularNotes: AppleNote[];
	selectedNoteId: string | null;
	viewMode: 'list' | 'grid';
	isLoading: boolean;
	colors: NoteColors;
	onSelectNote: (id: string) => void;
	onTogglePin: (id: string) => void;
	onDeleteNote: (id: string) => void;
	onRestoreNote: (id: string) => void;
	onEmptyTrash: () => void;
	onCreateNote: () => void;
}

export function NotesList({
	searchQuery, onSearchChange, activeFolderId, notes, filteredNotes, pinnedNotes, regularNotes,
	selectedNoteId, viewMode, isLoading, colors, onSelectNote, onTogglePin, onDeleteNote,
	onRestoreNote, onEmptyTrash, onCreateNote,
}: NotesListProps) {
	const { t, language } = useI18n();
	const formatDate = (ts: number) => formatNoteDate(ts, language, t('notesYesterday'));

	return (
		<div
			style={{
				width: '270px',
				minWidth: '220px',
				height: '100%',
				background: colors.listBg,
				borderRight: `1px solid ${colors.borderSubtle}`,
				display: 'flex',
				flexDirection: 'column',
				flexShrink: 0,
				overflow: 'hidden',
			}}
		>
			<div style={{ padding: '10px 12px 6px 12px' }}>
				<div
					style={{
						position: 'relative',
						display: 'flex',
						alignItems: 'center',
						background: colors.searchBg,
						border: `1px solid ${colors.searchBorder}`,
						borderRadius: '8px',
						padding: '5px 8px',
					}}
				>
					<Search size={14} style={{ color: colors.textSecondary, marginRight: '6px', flexShrink: 0 }} />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={t('notesSearchInput')}
						style={{ border: 'none', background: 'transparent', color: colors.appText, fontSize: '12.5px', width: '100%', outline: 'none' }}
					/>
					{searchQuery && (
						<button
							onClick={() => onSearchChange('')}
							style={{
								border: 'none',
								background: 'transparent',
								cursor: 'pointer',
								padding: 0,
								display: 'grid',
								placeItems: 'center',
								color: colors.textSecondary,
							}}
						>
							<X size={12} />
						</button>
					)}
				</div>
			</div>

			{activeFolderId === 'trash' && (
				<div
					style={{
						padding: '8px 12px',
						background: 'color-mix(in srgb, var(--danger) 18%, transparent)',
						borderBottom: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						fontSize: '11px',
					}}
				>
					<span style={{ color: 'var(--danger)', fontWeight: 500 }}>{t('notesTrashBannerTitle')}</span>
					{notes.some((n) => n.isDeleted) && (
						<button
							onClick={onEmptyTrash}
							style={{
								border: 'none',
								background: 'transparent',
								color: 'var(--danger)',
								fontWeight: 600,
								cursor: 'pointer',
								textDecoration: 'underline',
							}}
						>
							{t('notesEmptyTrashBtn')}
						</button>
					)}
				</div>
			)}

			<div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
				{isLoading ? (
					<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', gap: '8px', color: colors.textSecondary }}>
						<Loader2 className="animate-spin" size={20} color={colors.accentGold} />
						<span style={{ fontSize: '12px' }}>{t('notesLoading')}</span>
					</div>
				) : filteredNotes.length === 0 ? (
					<div
						style={{
							padding: '30px 16px',
							textAlign: 'center',
							fontSize: '12.5px',
							color: colors.textSecondary,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: '8px',
						}}
					>
						<StickyNote size={24} style={{ opacity: 0.4, color: colors.textSecondary }} />
						<span>{searchQuery ? t('notesNoNotesFound') : activeFolderId === 'trash' ? t('notesTrashEmpty') : t('notesFolderEmpty')}</span>
						{activeFolderId !== 'trash' && !searchQuery && (
							<button
								onClick={onCreateNote}
								style={{
									marginTop: '4px',
									padding: '5px 12px',
									borderRadius: '6px',
									border: 'none',
									background: colors.accentGold,
									color: '#000000',
									fontSize: '11.5px',
									fontWeight: 600,
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									gap: '4px',
								}}
							>
								<SquarePen size={12} />
								<span>{t('notesCreateFirst')}</span>
							</button>
						)}
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{pinnedNotes.length > 0 && (
							<NotesListSection
								label={t('notesPinnedLabel')}
								pinnedIcon
								items={pinnedNotes}
								selectedNoteId={selectedNoteId}
								activeFolderId={activeFolderId}
								viewMode={viewMode}
								colors={colors}
								formatDate={formatDate}
								onSelectNote={onSelectNote}
								onTogglePin={onTogglePin}
								onDeleteNote={onDeleteNote}
								onRestoreNote={onRestoreNote}
							/>
						)}
						{regularNotes.length > 0 && (
							<NotesListSection
								label={pinnedNotes.length > 0 ? t('notesNotesLabel') : undefined}
								items={regularNotes}
								selectedNoteId={selectedNoteId}
								activeFolderId={activeFolderId}
								viewMode={viewMode}
								colors={colors}
								formatDate={formatDate}
								onSelectNote={onSelectNote}
								onTogglePin={onTogglePin}
								onDeleteNote={onDeleteNote}
								onRestoreNote={onRestoreNote}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
