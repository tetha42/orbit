'use client';

import React from 'react';
import { Pin } from 'lucide-react';
import { useSound } from '@/core/sound';
import { NoteCard } from './NoteCard';
import type { AppleNote, NoteColors } from '../types';

interface NotesListSectionProps {
	label?: string;
	pinnedIcon?: boolean;
	items: AppleNote[];
	selectedNoteId: string | null;
	activeFolderId: string;
	viewMode: 'list' | 'grid';
	colors: NoteColors;
	formatDate: (ts: number) => string;
	onSelectNote: (id: string) => void;
	onTogglePin: (id: string) => void;
	onDeleteNote: (id: string) => void;
	onRestoreNote: (id: string) => void;
}

export function NotesListSection({
	label,
	pinnedIcon,
	items,
	selectedNoteId,
	activeFolderId,
	viewMode,
	colors,
	formatDate,
	onSelectNote,
	onTogglePin,
	onDeleteNote,
	onRestoreNote,
}: NotesListSectionProps) {
	const { playSystemSound } = useSound();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			{label && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '4px',
						fontSize: '10.5px',
						fontWeight: 700,
						color: pinnedIcon ? colors.accentGold : colors.textTertiary,
						textTransform: 'uppercase',
						letterSpacing: '0.4px',
						padding: '4px 6px',
					}}
				>
					{pinnedIcon && <Pin size={11} />}
					<span>{label}</span>
				</div>
			)}
			{items.map((note) => (
				<NoteCard
					key={note.id}
					note={note}
					isSelected={note.id === selectedNoteId}
					isTrash={activeFolderId === 'trash'}
					viewMode={viewMode}
					formatDate={formatDate}
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
	);
}
