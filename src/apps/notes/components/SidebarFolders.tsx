'use client';

import React from 'react';
import { Folder, StickyNote, Users, Cpu, BookOpen, User, Trash2, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { getFolderDisplayName } from '../utils/noteHelpers';
import { NewFolderInlineForm } from './NewFolderInlineForm';
import type { AppleNote, NoteFolder, NoteColors } from '../types';

interface SidebarFoldersProps {
	folders: NoteFolder[];
	notes: AppleNote[];
	activeFolderId: string;
	showNewFolderModal: boolean;
	newFolderName: string;
	colors: NoteColors;
	onSelectFolder: (id: string) => void;
	onShowNewFolderModal: (show: boolean) => void;
	onChangeNewFolderName: (name: string) => void;
	onCreateFolder: () => void;
	onDeleteFolder: (id: string, e: React.MouseEvent) => void;
}

export function SidebarFolders({
	folders, notes, activeFolderId, showNewFolderModal, newFolderName, colors,
	onSelectFolder, onShowNewFolderModal, onChangeNewFolderName, onCreateFolder, onDeleteFolder,
}: SidebarFoldersProps) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();

	const renderFolderIcon = (type?: string, size = 15) => {
		switch (type) {
			case 'quick': return <StickyNote size={size} color="var(--accent)" />;
			case 'club': return <Users size={size} color="var(--accent)" />;
			case 'teknofest': return <Cpu size={size} color="#30b0c7" />;
			case 'workshops': return <BookOpen size={size} color="#a855f7" />;
			case 'personal': return <User size={size} color="var(--success)" />;
			case 'trash': return <Trash2 size={size} color="var(--danger)" />;
			default: return <Folder size={size} color={colors.accentGold} />;
		}
	};

	return (
		<div
			style={{
				width: '210px',
				minWidth: '180px',
				height: '100%',
				background: colors.sidebarBg,
				borderRight: `1px solid ${colors.borderSubtle}`,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				padding: '10px 8px',
				flexShrink: 0,
				overflowY: 'auto',
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
				<div style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, padding: '4px 8px 6px 8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
					{t('notesFoldersSection')}
				</div>

				{folders.map((fld) => {
					const count = notes.filter((n) => !n.isDeleted && (fld.id === 'all' || n.folderId === fld.id)).length;
					const isSelected = activeFolderId === fld.id;
					return (
						<button
							key={fld.id}
							onClick={() => { onSelectFolder(fld.id); playSystemSound(); }}
							style={{
								display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px',
								borderRadius: '6px', border: 'none', background: isSelected ? colors.folderActiveBg : 'transparent',
								color: isSelected ? colors.folderActiveText : colors.appText, fontSize: '13px',
								fontWeight: isSelected ? 600 : 400, cursor: 'pointer', textAlign: 'left',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
								{renderFolderIcon(fld.iconType)}
								<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{getFolderDisplayName(fld, t)}
								</span>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
								<span style={{ fontSize: '11.5px', color: colors.textSecondary }}>{count}</span>
								{!fld.isSystem && (
									<span onClick={(e) => onDeleteFolder(fld.id, e)} title={t('notesDeleteFolder')} style={{ padding: '2px', opacity: 0.6, cursor: 'pointer' }}>
										<X size={12} />
									</span>
								)}
							</div>
						</button>
					);
				})}

				<div style={{ height: '1px', background: colors.borderSubtle, margin: '6px 4px' }} />

				<button
					onClick={() => { onSelectFolder('trash'); playSystemSound(); }}
					style={{
						display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px',
						borderRadius: '6px', border: 'none', background: activeFolderId === 'trash' ? 'color-mix(in srgb, var(--danger) 25%, transparent)' : 'transparent',
						color: activeFolderId === 'trash' ? 'var(--danger)' : colors.appText, fontSize: '13px',
						fontWeight: activeFolderId === 'trash' ? 600 : 400, cursor: 'pointer', textAlign: 'left',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						{renderFolderIcon('trash')}
						<span>{t('notesFolderTrash')}</span>
					</div>
					<span style={{ fontSize: '11.5px', color: colors.textSecondary }}>{notes.filter((n) => n.isDeleted).length}</span>
				</button>
			</div>

			<NewFolderInlineForm
				showNewFolderModal={showNewFolderModal}
				newFolderName={newFolderName}
				colors={colors}
				onShowNewFolderModal={onShowNewFolderModal}
				onChangeNewFolderName={onChangeNewFolderName}
				onCreateFolder={onCreateFolder}
			/>
		</div>
	);
}
