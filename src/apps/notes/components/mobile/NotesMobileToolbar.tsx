'use client';

import React from 'react';
import { ChevronLeft, Pin, Trash2, CheckSquare, List, Bold, Italic, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatNoteDate } from '../../utils/noteHelpers';
import type { AppleNote, NoteColors } from '../../types';

const fmtBtnStyle: React.CSSProperties = {
	background: 'rgba(255, 255, 255, 0.06)',
	border: 'none',
	borderRadius: '6px',
	padding: '5px 8px',
	color: 'inherit',
	cursor: 'pointer',
	display: 'inline-flex',
	alignItems: 'center',
};

interface NotesMobileHeaderProps {
	activeNote: AppleNote;
	syncStatus: 'saved' | 'saving' | 'offline';
	colors: NoteColors;
	playSound: () => void;
	onBack: () => void;
	onDeleteNote: (id: string) => void;
	onTogglePin: (id: string) => void;
}

export function NotesMobileHeader({
	activeNote,
	syncStatus,
	colors,
	playSound,
	onBack,
	onDeleteNote,
	onTogglePin,
}: NotesMobileHeaderProps) {
	const { t, language } = useI18n();

	return (
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
					playSound();
					onBack();
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
				<span>{t('notesFoldersSection')}</span>
			</button>

			<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
				{syncStatus === 'saving' ? (
					<span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
						<Loader2 size={12} className="spin-animation" />
						<span>{t('notesSavingStatus')}</span>
					</span>
				) : (
					<span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
						{formatNoteDate(activeNote.updatedAt, language, t('notesYesterday'))}
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
						color: activeNote.isPinned ? 'var(--warning)' : 'var(--text-muted)',
						cursor: 'pointer',
						padding: '8px',
						display: 'grid',
						placeItems: 'center',
					}}
				>
					<Pin size={17} fill={activeNote.isPinned ? 'var(--warning)' : 'none'} />
				</button>
				<button
					type="button"
					onClick={() => {
						onDeleteNote(activeNote.id);
						onBack();
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
						playSound();
						onBack();
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
					{t('done')}
				</button>
			</div>
		</div>
	);
}

export function NotesMobileFormatBar({
	colors,
	onInsertMarkdown,
}: {
	colors: NoteColors;
	onInsertMarkdown: (prefix: string, suffix?: string) => void;
}) {
	const { t } = useI18n();
	const actions = [
		['**', '**', Bold, 'notesBold'],
		['*', '*', Italic, 'notesItalic'],
		['\n- [ ] ', '', CheckSquare, 'notesChecklist'],
		['\n- ', '', List, 'notesBulletList'],
	] as const;

	return (
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
			{actions.map(([prefix, suffix, Icon, key]) => (
				<button
					key={key}
					type="button"
					onClick={() => onInsertMarkdown(prefix, suffix)}
					style={fmtBtnStyle}
					title={t(key)}
				>
					<Icon size={14} />
				</button>
			))}
		</div>
	);
}
