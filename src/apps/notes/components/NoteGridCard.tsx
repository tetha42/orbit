'use client';

import React from 'react';
import { Pin } from 'lucide-react';
import type { AppleNote, NoteColors } from '../types';

export function NoteGridCard({
	note,
	isSelected,
	bodySnippet,
	formattedDate,
	colors,
	unpinTitle,
	contextMenuProps,
	onSelect,
	onTogglePin,
}: {
	note: AppleNote;
	isSelected: boolean;
	bodySnippet: string;
	formattedDate: string;
	colors: NoteColors;
	unpinTitle: string;
	contextMenuProps: React.HTMLAttributes<HTMLDivElement>;
	onSelect: () => void;
	onTogglePin: () => void;
}) {
	return (
		<div
			onClick={onSelect}
			{...contextMenuProps}
			style={{
				padding: '10px',
				borderRadius: '8px',
				background: isSelected ? colors.cardSelectedBg : colors.gridCardBg,
				border: isSelected
					? `1.5px solid ${colors.cardSelectedBorder}`
					: `1px solid ${colors.gridCardBorder}`,
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
						title={unpinTitle}
						style={{
							border: 'none',
							background: 'transparent',
							padding: 0,
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
						}}
					>
						<Pin size={11} color={colors.accentGold} />
					</button>
				)}
			</div>
			<div style={{ fontSize: '11px', color: colors.textSecondary }}>{formattedDate}</div>
			<div
				style={{
					fontSize: '11.5px',
					color: colors.textSecondary,
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
				}}
			>
				{bodySnippet}
			</div>
		</div>
	);
}
