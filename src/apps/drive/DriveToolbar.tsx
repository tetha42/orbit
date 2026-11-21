'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from './Drive.module.css';

interface DriveToolbarProps {
	breadcrumbs: Array<{ id: string; name: string }>;
	query: string;
	isNewFolderOpen: boolean;
	onOpenFolder: (folder: { id: string; name: string } | null) => void;
	onQueryChange: (q: string) => void;
	onCreateFolder: (name: string) => Promise<boolean | void>;
	onCloseNewFolder: () => void;
}

export function DriveToolbar({
	breadcrumbs,
	query,
	isNewFolderOpen,
	onOpenFolder,
	onQueryChange,
	onCreateFolder,
	onCloseNewFolder,
}: DriveToolbarProps) {
	const { t } = useI18n();
	const [newFolderName, setNewFolderName] = useState('');

	const handleCreate = async () => {
		const trimmed = newFolderName.trim();
		if (!trimmed) return;
		await onCreateFolder(trimmed);
		setNewFolderName('');
		onCloseNewFolder();
	};

	return (
		<>
			<div className={s.topBar}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', flexWrap: 'wrap' }}>
					<button
						type="button"
						onClick={() => onOpenFolder(null)}
						style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
					>
						{t('driveBreadcrumbRoot')}
					</button>
					{breadcrumbs.map((b) => (
						<React.Fragment key={b.id}>
							<span style={{ color: 'var(--text-secondary)' }}>/</span>
							<button
								type="button"
								onClick={() => onOpenFolder(b)}
								style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
							>
								{b.name}
							</button>
						</React.Fragment>
					))}
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<Search size={14} color="var(--text-secondary)" />
					<input
						type="text"
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						placeholder={t('driveSearchPlaceholder')}
						style={{
							width: '190px',
							padding: '5px 10px',
							borderRadius: '8px',
							border: '1px solid var(--border-subtle)',
							background: 'var(--surface-hover)',
							color: 'var(--text-primary)',
							fontSize: '12px',
						}}
					/>
				</div>
			</div>

			{isNewFolderOpen && (
				<div className={s.folderBar}>
					<input
						type="text"
						value={newFolderName}
						onChange={(e) => setNewFolderName(e.target.value)}
						placeholder={t('driveFolderNameLabel')}
						className={s.searchInput}
						style={{ flex: 1, padding: '5px 10px', borderRadius: '6px' }}
					/>
					<button
						type="button"
						onClick={() => void handleCreate()}
						style={{
							background: 'var(--accent)',
							color: 'var(--text-on-accent)',
							border: 'none',
							borderRadius: '6px',
							padding: '5px 12px',
							fontSize: '12px',
							cursor: 'pointer',
						}}
					>
						{t('driveCreateFolderTitle')}
					</button>
				</div>
			)}
		</>
	);
}
