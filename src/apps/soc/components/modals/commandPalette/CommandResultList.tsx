'use client';

import React from 'react';
import type { CommandItem } from './useSocCommands';

interface CommandResultListProps {
	commands: CommandItem[];
	selectedIndex: number;
	emptyLabel: string;
	onSelectIndex: (idx: number) => void;
	onRunCommand: (cmd: CommandItem) => void;
}

export function CommandResultList({
	commands,
	selectedIndex,
	emptyLabel,
	onSelectIndex,
	onRunCommand,
}: CommandResultListProps) {
	if (commands.length === 0) {
		return (
			<div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
				{emptyLabel}
			</div>
		);
	}

	return (
		<>
			{commands.map((cmd, idx) => {
				const isSelected = idx === selectedIndex;
				return (
					<div
						key={cmd.id}
						onClick={() => onRunCommand(cmd)}
						onMouseEnter={() => onSelectIndex(idx)}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							padding: '9px 12px',
							borderRadius: '6px',
							cursor: 'pointer',
							background: isSelected ? 'var(--fill-strong, rgba(0, 0, 0, 0.08))' : 'transparent',
							transition: 'background-color 80ms ease',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
							<div
								style={{
									color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
									display: 'grid',
									placeItems: 'center',
								}}
							>
								{cmd.icon}
							</div>
							<div>
								<div style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500 }}>
									{cmd.title}
								</div>
								<div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
									{cmd.category}
								</div>
							</div>
						</div>

						{cmd.shortcut && (
							<span
								style={{
									fontSize: '10px',
									fontFamily: 'monospace',
									fontWeight: 700,
									padding: '2px 6px',
									borderRadius: '4px',
									background: 'var(--fill-soft)',
									color: 'var(--text-secondary)',
								}}
							>
								{cmd.shortcut}
							</span>
						)}
					</div>
				);
			})}
		</>
	);
}
