'use client';

import React from 'react';
import type { SelectDialogOption } from './types';

interface DialogSelectListProps {
	titleId: string;
	items: SelectDialogOption[];
	selectedVal: string;
	onSelect: (value: string) => void;
	onSubmit: (value: string) => void;
}

export function DialogSelectList({
	titleId,
	items,
	selectedVal,
	onSelect,
	onSubmit,
}: DialogSelectListProps) {
	return (
		<div
			role="radiogroup"
			aria-labelledby={titleId}
			style={{
				marginTop: 12,
				display: 'flex',
				flexDirection: 'column',
				gap: 6,
				maxHeight: 220,
				overflowY: 'auto',
				cursor: 'auto',
			}}
		>
			{items.map((item) => {
				const active = selectedVal === item.value;
				return (
					<button
						key={item.value}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onSelect(item.value)}
						onDoubleClick={() => onSubmit(item.value)}
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'flex-start',
							gap: 2,
							padding: '8px 10px',
							borderRadius: 8,
							border: `1px solid ${active ? 'var(--accent)' : 'var(--card-border)'}`,
							background: active
								? 'color-mix(in srgb, var(--accent) 14%, var(--card-bg))'
								: 'var(--card-bg)',
							color: 'var(--text-primary)',
							textAlign: 'left',
							cursor: 'pointer',
						}}
					>
						<span style={{ fontSize: 12.5, fontWeight: 650 }}>{item.label}</span>
						{item.description && (
							<span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
								{item.description}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
