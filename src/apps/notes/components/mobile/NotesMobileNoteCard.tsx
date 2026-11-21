'use client';

import React from 'react';
import { Pin } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatNoteDate, getNotePreviewSnippet } from '../../utils/noteHelpers';
import type { AppleNote } from '../../types';

interface NotesMobileNoteCardProps {
	note: AppleNote;
	pinned?: boolean;
	onClick: () => void;
}

export function NotesMobileNoteCard({ note, pinned, onClick }: NotesMobileNoteCardProps) {
	const { t, language } = useI18n();

	return (
		<div
			onClick={onClick}
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
				{pinned && <Pin size={13} color="#ffcc00" fill="#ffcc00" style={{ flexShrink: 0 }} />}
			</div>
			<div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
				<span style={{ fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
					{formatNoteDate(note.updatedAt, language, t('notesYesterday'))}
				</span>
				<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
					{getNotePreviewSnippet(note.body, t('notesNoExtraText'))}
				</span>
			</div>
		</div>
	);
}
