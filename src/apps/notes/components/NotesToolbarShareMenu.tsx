'use client';

import React from 'react';
import { Share2, Copy, Check, Download, Printer } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { NoteColors } from '../types';

interface NotesToolbarShareMenuProps {
	showShareMenu: boolean;
	copied: boolean;
	colors: NoteColors;
	onToggleShareMenu: () => void;
	onCopyText: () => void;
	onDownloadMarkdown: () => void;
	onPrint: () => void;
}

const menuBtnStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
	padding: '6px 10px',
	borderRadius: '6px',
	border: 'none',
	background: 'transparent',
	fontSize: '12.5px',
	cursor: 'pointer',
	textAlign: 'left',
};

export function NotesToolbarShareMenu({
	showShareMenu,
	copied,
	colors,
	onToggleShareMenu,
	onCopyText,
	onDownloadMarkdown,
	onPrint,
}: NotesToolbarShareMenuProps) {
	const { t } = useI18n();

	return (
		<div style={{ position: 'relative' }}>
			<button
				onClick={onToggleShareMenu}
				title={t('notesShareExport')}
				style={{
					padding: '6px',
					borderRadius: '6px',
					border: 'none',
					background: showShareMenu ? colors.btnActive : 'transparent',
					color: colors.appText,
					cursor: 'pointer',
					display: 'grid',
					placeItems: 'center',
				}}
			>
				<Share2 size={16} />
			</button>

			{showShareMenu && (
				<div
					style={{
						position: 'absolute',
						top: '32px',
						right: 0,
						width: '180px',
						background: colors.popoverBg,
						borderRadius: '8px',
						boxShadow: colors.popoverShadow,
						border: `1px solid ${colors.popoverBorder}`,
						padding: '4px',
						zIndex: 999,
						display: 'flex',
						flexDirection: 'column',
						gap: '2px',
					}}
				>
					<button onClick={onCopyText} style={{ ...menuBtnStyle, color: colors.appText }}>
						{copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
						<span>{copied ? t('dlgCopied') : t('decisionsCopyText')}</span>
					</button>
					<button onClick={onDownloadMarkdown} style={{ ...menuBtnStyle, color: colors.appText }}>
						<Download size={14} />
						<span>{t('notesDownloadMd')}</span>
					</button>
					<button onClick={onPrint} style={{ ...menuBtnStyle, color: colors.appText }}>
						<Printer size={14} />
						<span>{t('notesPrintPdf')}</span>
					</button>
				</div>
			)}
		</div>
	);
}
