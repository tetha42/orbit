'use client';

import React, { useMemo } from 'react';
import { Pin, RotateCcw, Trash2, Copy } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import type { AppleNote, NoteColors } from '../types';

interface NoteCardProps {
	note: AppleNote;
	isSelected: boolean;
	isTrash: boolean;
	viewMode: 'list' | 'grid';
	formatDate: (t: number) => string;
	colors: NoteColors;
	onSelect: () => void;
	onTogglePin: () => void;
	onDelete: () => void;
	onRestore: () => void;
}

export function NoteCard({
	note,
	isSelected,
	isTrash,
	viewMode,
	formatDate,
	colors,
	onSelect,
	onTogglePin,
	onDelete,
	onRestore,
}: NoteCardProps) {
	const { t } = useI18n();

	const menuItems = useMemo<MenuItem[]>(() => {
		if (isTrash) {
			return [
				{
					id: `restore-${note.id}`,
					label: t('ctxNotesRestore'),
					icon: <RotateCcw size={13} />,
					action: () => onRestore(),
				},
				{
					id: `delete-perm-${note.id}`,
					label: t('ctxNotesDeletePerm'),
					icon: <Trash2 size={13} />,
					danger: true,
					action: () => onDelete(),
				},
			];
		}

		return [
			{
				id: `pin-${note.id}`,
				label: note.isPinned ? t('ctxNotesUnpin') : t('ctxNotesPin'),
				icon: <Pin size={13} />,
				action: () => onTogglePin(),
			},
			{
				id: `copy-${note.id}`,
				label: t('ctxNotesCopyText'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(`${note.title}\n\n${note.body}`);
				},
			},
			{ id: `sep-${note.id}`, label: '', separator: true },
			{
				id: `delete-${note.id}`,
				label: t('ctxNotesDelete'),
				icon: <Trash2 size={13} />,
				danger: true,
				action: () => onDelete(),
			},
		];
	}, [isTrash, note.id, note.isPinned, note.title, note.body, t, onRestore, onDelete, onTogglePin]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	const bodySnippet =
		note.body
			.split('\n')
			.map((l) => l.replace(/^#+ /, '').replace(/^- \[(x| )\] /, '').replace(/^- /, ''))
			.filter((l) => l.trim().length > 0)[0] || t('notesNoExtraText');

	if (viewMode === 'grid') {
		return (
			<div
				onClick={onSelect}
				{...contextMenuProps}
				style={{
					padding: '10px',
					borderRadius: '8px',
					background: isSelected ? colors.cardSelectedBg : colors.gridCardBg,
					border: isSelected ? `1.5px solid ${colors.cardSelectedBorder}` : `1px solid ${colors.gridCardBorder}`,
					cursor: 'pointer',
					display: 'flex',
					flexDirection: 'column',
					gap: '4px',
					boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<span
						style={{
							fontWeight: 600,
							fontSize: '13px',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
							color: isSelected ? colors.cardSelectedTitle : colors.appText,
						}}
					>
						{note.title}
					</span>
					{note.isPinned && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onTogglePin();
							}}
							title={t('notesUnpin')}
							style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
						>
							<Pin size={11} color={colors.accentGold} />
						</button>
					)}
				</div>
				<div style={{ fontSize: '11px', color: colors.textSecondary }}>{formatDate(note.updatedAt)}</div>
				<div style={{ fontSize: '11.5px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
					{bodySnippet}
				</div>
			</div>
		);
	}

	return (
		<div
			onClick={onSelect}
			{...contextMenuProps}
			style={{
				padding: '8px 10px',
				borderRadius: '7px',
				background: isSelected ? colors.cardSelectedBg : 'transparent',
				border: isSelected ? `1.5px solid ${colors.cardSelectedBorder}` : '1.5px solid transparent',
				cursor: 'pointer',
				display: 'flex',
				flexDirection: 'column',
				gap: '3px',
				transition: 'background 0.1s ease',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
				<span
					style={{
						fontSize: '13px',
						fontWeight: 600,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						color: isSelected ? colors.cardSelectedTitle : colors.appText,
					}}
				>
					{note.title}
				</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
					{note.isPinned && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onTogglePin();
							}}
							title={t('notesUnpin')}
							style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
						>
							<Pin size={11} color={colors.accentGold} />
						</button>
					)}
				</div>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
				<span style={{ fontWeight: 500, color: colors.textSecondary, flexShrink: 0 }}>
					{formatDate(note.updatedAt)}
				</span>
				<span
					style={{
						color: colors.textSecondary,
						opacity: 0.85,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					}}
				>
					{bodySnippet}
				</span>
			</div>

			{isTrash && (
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onRestore();
						}}
						style={{
							border: 'none',
							background: 'transparent',
							color: 'var(--accent)',
							fontSize: '11px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '2px',
						}}
					>
						<RotateCcw size={10} />
						<span>{t('notesRestore')}</span>
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						style={{
							border: 'none',
							background: 'transparent',
							color: '#ef4444',
							fontSize: '11px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '2px',
						}}
					>
						<Trash2 size={10} />
						<span>{t('delete')}</span>
					</button>
				</div>
			)}
		</div>
	);
}
