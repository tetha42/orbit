'use client';

import React from 'react';
import { FolderPlus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { NoteColors } from '../types';

interface NewFolderInlineFormProps {
	showNewFolderModal: boolean;
	newFolderName: string;
	colors: NoteColors;
	onShowNewFolderModal: (show: boolean) => void;
	onChangeNewFolderName: (name: string) => void;
	onCreateFolder: () => void;
}

export function NewFolderInlineForm({
	showNewFolderModal,
	newFolderName,
	colors,
	onShowNewFolderModal,
	onChangeNewFolderName,
	onCreateFolder,
}: NewFolderInlineFormProps) {
	const { t } = useI18n();

	return (
		<div style={{ paddingTop: '8px', borderTop: `1px solid ${colors.borderSubtle}` }}>
			{showNewFolderModal ? (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
					<input
						type="text"
						value={newFolderName}
						onChange={(e) => onChangeNewFolderName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') onCreateFolder();
							if (e.key === 'Escape') onShowNewFolderModal(false);
						}}
						placeholder={`${t('notesNewFolder')}...`}
						autoFocus
						style={{
							padding: '5px 8px',
							borderRadius: '5px',
							border: `1px solid ${colors.accentGold}`,
							background: 'rgba(255, 255, 255, 0.08)',
							color: colors.appText,
							fontSize: '12px',
							outline: 'none',
						}}
					/>
					<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
						<button
							onClick={() => onShowNewFolderModal(false)}
							style={{ padding: '3px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: colors.textSecondary, fontSize: '11px', cursor: 'pointer' }}
						>
							{t('cancel')}
						</button>
						<button
							onClick={onCreateFolder}
							style={{ padding: '3px 8px', borderRadius: '4px', border: 'none', background: colors.accentGold, color: '#000000', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
						>
							{t('add')}
						</button>
					</div>
				</div>
			) : (
				<button
					onClick={() => onShowNewFolderModal(true)}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						padding: '6px 8px',
						borderRadius: '6px',
						border: 'none',
						background: 'transparent',
						color: colors.textSecondary,
						fontSize: '12.5px',
						cursor: 'pointer',
						width: '100%',
						textAlign: 'left',
					}}
				>
					<FolderPlus size={14} color={colors.accentGold} />
					<span>{t('notesNewFolder')}</span>
				</button>
			)}
		</div>
	);
}
