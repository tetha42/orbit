'use client';

import React from 'react';
import {
	Folder,
	FolderPlus,
	StickyNote,
	Users,
	Cpu,
	BookOpen,
	User,
	Trash2,
	X,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
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
	folders,
	notes,
	activeFolderId,
	showNewFolderModal,
	newFolderName,
	colors,
	onSelectFolder,
	onShowNewFolderModal,
	onChangeNewFolderName,
	onCreateFolder,
	onDeleteFolder,
}: SidebarFoldersProps) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();

	const renderFolderIcon = (type?: string, size = 15) => {
		switch (type) {
			case 'quick':
				return <StickyNote size={size} color="var(--accent)" />;
			case 'club':
				return <Users size={size} color="#0a84ff" />;
			case 'teknofest':
				return <Cpu size={size} color="#30b0c7" />;
			case 'workshops':
				return <BookOpen size={size} color="#a855f7" />;
			case 'personal':
				return <User size={size} color="#10b981" />;
			case 'trash':
				return <Trash2 size={size} color="#ef4444" />;
			default:
				return <Folder size={size} color={colors.accentGold} />;
		}
	};

	const getFolderName = (fld?: NoteFolder | null) => {
		if (!fld) return t('notesFolderQuick');
		if (!fld.isSystem) return fld.name;
		switch (fld.id) {
			case 'all': return t('notesFolderAll');
			case 'quick': return t('notesFolderQuick');
			case 'club': return t('notesFolderClub');
			case 'teknofest': return t('notesFolderTeknofest');
			case 'workshops': return t('notesFolderWorkshops');
			case 'personal': return t('notesFolderPersonal');
			case 'trash': return t('notesFolderTrash');
			default: return fld.name;
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
				<div
					style={{
						fontSize: '11px',
						fontWeight: 700,
						color: colors.textSecondary,
						padding: '4px 8px 6px 8px',
						textTransform: 'uppercase',
						letterSpacing: '0.4px',
					}}
				>
					{t('notesFoldersSection')}
				</div>

				{folders.map((fld) => {
					const count = notes.filter((n) => !n.isDeleted && (fld.id === 'all' || n.folderId === fld.id)).length;
					const isSelected = activeFolderId === fld.id;

					return (
						<button
							key={fld.id}
							onClick={() => {
								onSelectFolder(fld.id);
								playSystemSound();
							}}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '6px 10px',
								borderRadius: '6px',
								border: 'none',
								background: isSelected ? colors.folderActiveBg : 'transparent',
								color: isSelected ? colors.folderActiveText : colors.appText,
								fontSize: '13px',
								fontWeight: isSelected ? 600 : 400,
								cursor: 'pointer',
								textAlign: 'left',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
								{renderFolderIcon(fld.iconType)}
								<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{getFolderName(fld)}
								</span>
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
								<span style={{ fontSize: '11.5px', color: colors.textSecondary }}>{count}</span>
								{!fld.isSystem && (
									<span
										onClick={(e) => onDeleteFolder(fld.id, e)}
										title={t('notesDeleteFolder')}
										style={{ padding: '2px', opacity: 0.6, cursor: 'pointer' }}
									>
										<X size={12} />
									</span>
								)}
							</div>
						</button>
					);
				})}

				<div style={{ height: '1px', background: colors.borderSubtle, margin: '6px 4px' }} />

				<button
					onClick={() => {
						onSelectFolder('trash');
						playSystemSound();
					}}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '6px 10px',
						borderRadius: '6px',
						border: 'none',
						background: activeFolderId === 'trash' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
						color: activeFolderId === 'trash' ? '#ef4444' : colors.appText,
						fontSize: '13px',
						fontWeight: activeFolderId === 'trash' ? 600 : 400,
						cursor: 'pointer',
						textAlign: 'left',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						{renderFolderIcon('trash')}
						<span>{t('notesFolderTrash')}</span>
					</div>
					<span style={{ fontSize: '11.5px', color: colors.textSecondary }}>
						{notes.filter((n) => n.isDeleted).length}
					</span>
				</button>
			</div>

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
								style={{
									padding: '3px 8px',
									borderRadius: '4px',
									border: 'none',
									background: 'transparent',
									color: colors.textSecondary,
									fontSize: '11px',
									cursor: 'pointer',
								}}
							>
								{t('cancel')}
							</button>
							<button
								onClick={onCreateFolder}
								style={{
									padding: '3px 8px',
									borderRadius: '4px',
									border: 'none',
									background: colors.accentGold,
									color: '#000000',
									fontSize: '11px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
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
		</div>
	);
}
