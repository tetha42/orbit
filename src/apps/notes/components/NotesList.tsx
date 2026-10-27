'use client';

import React from 'react';
import { Search, X, Loader2, StickyNote, SquarePen, Pin } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { NoteCard } from './NoteCard';
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
	searchQuery,
	onSearchChange,
	activeFolderId,
	notes,
	filteredNotes,
	pinnedNotes,
	regularNotes,
	selectedNoteId,
	viewMode,
	isLoading,
	colors,
	onSelectNote,
	onTogglePin,
	onDeleteNote,
	onRestoreNote,
	onEmptyTrash,
	onCreateNote,
}: NotesListProps) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();

	const formatNoteDate = (timestamp: number) => {
		const date = new Date(timestamp);
		const now = new Date();
		const locale = language === 'tr' ? 'tr-TR' : 'en-US';
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
						style={{
							border: 'none',
							background: 'transparent',
							color: colors.appText,
							fontSize: '12.5px',
							width: '100%',
							outline: 'none',
						}}
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
						background: 'rgba(239, 68, 68, 0.18)',
						borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						fontSize: '11px',
					}}
				>
					<span style={{ color: '#ef4444', fontWeight: 500 }}>{t('notesTrashBannerTitle')}</span>
					{notes.some((n) => n.isDeleted) && (
						<button
							onClick={onEmptyTrash}
							style={{
								border: 'none',
								background: 'transparent',
								color: '#ef4444',
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
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							height: '180px',
							gap: '8px',
							color: colors.textSecondary,
						}}
					>
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
						<span>
							{searchQuery
								? t('notesNoNotesFound')
								: activeFolderId === 'trash'
								? t('notesTrashEmpty')
								: t('notesFolderEmpty')}
						</span>
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
							<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '4px',
										fontSize: '10.5px',
										fontWeight: 700,
										color: colors.accentGold,
										textTransform: 'uppercase',
										letterSpacing: '0.4px',
										padding: '4px 6px',
									}}
								>
									<Pin size={11} />
									<span>{t('notesPinnedLabel')}</span>
								</div>
								{pinnedNotes.map((note) => (
									<NoteCard
										key={note.id}
										note={note}
										isSelected={note.id === selectedNoteId}
										isTrash={activeFolderId === 'trash'}
										viewMode={viewMode}
										formatDate={formatNoteDate}
										colors={colors}
										onSelect={() => {
											onSelectNote(note.id);
											playSystemSound();
										}}
										onTogglePin={() => onTogglePin(note.id)}
										onDelete={() => onDeleteNote(note.id)}
										onRestore={() => onRestoreNote(note.id)}
									/>
								))}
							</div>
						)}

						{regularNotes.length > 0 && (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
								{pinnedNotes.length > 0 && (
									<div
										style={{
											fontSize: '10.5px',
											fontWeight: 700,
											color: colors.textTertiary,
											textTransform: 'uppercase',
											letterSpacing: '0.4px',
											padding: '4px 6px',
										}}
									>
										{t('notesNotesLabel')}
									</div>
								)}
								{regularNotes.map((note) => (
									<NoteCard
										key={note.id}
										note={note}
										isSelected={note.id === selectedNoteId}
										isTrash={activeFolderId === 'trash'}
										viewMode={viewMode}
										formatDate={formatNoteDate}
										colors={colors}
										onSelect={() => {
											onSelectNote(note.id);
											playSystemSound();
										}}
										onTogglePin={() => onTogglePin(note.id)}
										onDelete={() => onDeleteNote(note.id)}
										onRestore={() => onRestoreNote(note.id)}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
