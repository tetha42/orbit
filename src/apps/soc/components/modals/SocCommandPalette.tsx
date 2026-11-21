'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useSocCommands } from './commandPalette/useSocCommands';
import { CommandResultList } from './commandPalette/CommandResultList';
import styles from './SocModals.module.css';

interface SocCommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
}

export const SocCommandPalette: React.FC<SocCommandPaletteProps> = ({ isOpen, onClose }) => {
	const { commands, copy } = useSocCommands();
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setQuery('');
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [isOpen]);

	const filteredCommands = commands.filter((cmd) => {
		const q = query.toLowerCase();
		return (
			cmd.title.toLowerCase().includes(q) ||
			cmd.searchAlt.toLowerCase().includes(q) ||
			cmd.category.toLowerCase().includes(q)
		);
	});

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const cmd = filteredCommands[selectedIndex];
			if (cmd) {
				cmd.action();
				onClose();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	};

	if (!isOpen) return null;

	return (
		<div className={styles.backdrop} onClick={onClose}>
			<div
				className={styles.modal}
				style={{ maxWidth: '580px', borderRadius: '12px', overflow: 'hidden' }}
				onClick={(e) => e.stopPropagation()}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '10px',
						padding: '14px 18px',
						borderBottom: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
						background: 'var(--window-titlebar, var(--fill-softer))',
					}}
				>
					<Search size={16} style={{ color: 'var(--text-secondary)' }} />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						onKeyDown={handleKeyDown}
						placeholder={copy.placeholder}
						style={{
							flex: 1,
							border: 'none',
							background: 'transparent',
							outline: 'none',
							fontSize: '13px',
							color: 'var(--text-primary)',
						}}
					/>
					<span
						style={{
							fontSize: '10.5px',
							fontWeight: 600,
							padding: '2px 6px',
							borderRadius: '4px',
							background: 'var(--fill-soft)',
							color: 'var(--text-secondary)',
						}}
					>
						ESC
					</span>
				</div>

				<div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px' }}>
					<CommandResultList
						commands={filteredCommands}
						selectedIndex={selectedIndex}
						emptyLabel={copy.noResults}
						onSelectIndex={setSelectedIndex}
						onRunCommand={(cmd) => {
							cmd.action();
							onClose();
						}}
					/>
				</div>

				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '8px 14px',
						borderTop: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
						background: 'var(--fill-softer)',
						fontSize: '11px',
						color: 'var(--text-secondary)',
					}}
				>
					<span>{copy.footerHint}</span>
					<span>⌘K / Ctrl+K</span>
				</div>
			</div>
		</div>
	);
};
export default SocCommandPalette;
