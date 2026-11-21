'use client';

import React from 'react';
import { Heading1, Heading2, Bold, Italic, Strikethrough, CheckSquare, List, ListOrdered, Table, Code, Quote } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { NoteColors } from '../types';

interface NotesFormattingBarProps {
	colors: NoteColors;
	onInsertText: (prefix: string, suffix?: string) => void;
	onInsertChecklist: () => void;
	onInsertTable: () => void;
}

const iconBtnStyle: React.CSSProperties = {
	padding: '5px 7px',
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	display: 'grid',
	placeItems: 'center',
};

export function NotesFormattingBar({
	colors,
	onInsertText,
	onInsertChecklist,
	onInsertTable,
}: NotesFormattingBarProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
			<button onClick={() => onInsertText('# ')} title={t('notesHeading1')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Heading1 size={15} />
			</button>
			<button onClick={() => onInsertText('## ')} title={t('notesHeading2')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Heading2 size={15} />
			</button>
			<button onClick={() => onInsertText('**', '**')} title={t('notesBold')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Bold size={15} />
			</button>
			<button onClick={() => onInsertText('*', '*')} title={t('notesItalic')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Italic size={15} />
			</button>
			<button onClick={() => onInsertText('~~', '~~')} title={t('notesStrikethrough')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Strikethrough size={15} />
			</button>
			<div style={{ width: '1px', height: '18px', background: colors.borderDivider, margin: '0 2px' }} />
			<button onClick={onInsertChecklist} title={t('notesChecklist')} style={{ ...iconBtnStyle, color: colors.accentGold }}>
				<CheckSquare size={16} />
			</button>
			<button onClick={() => onInsertText('- ')} title={t('notesBulletList')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<List size={15} />
			</button>
			<button onClick={() => onInsertText('1. ')} title={t('notesNumberList')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<ListOrdered size={15} />
			</button>
			<button onClick={onInsertTable} title={t('notesTable')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Table size={15} />
			</button>
			<button onClick={() => onInsertText('```\n', '\n```')} title={t('notesCodeBlock')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Code size={15} />
			</button>
			<button onClick={() => onInsertText('> ')} title={t('notesQuote')} style={{ ...iconBtnStyle, color: colors.appText }}>
				<Quote size={15} />
			</button>
		</div>
	);
}
