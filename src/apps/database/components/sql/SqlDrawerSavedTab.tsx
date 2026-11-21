'use client';

import React, { useState } from 'react';
import { Trash2, Play, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { SavedQuery } from '../../utils/sqlStorage';

interface SqlDrawerSavedTabProps {
	currentQuery: string;
	savedQueries: SavedQuery[];
	onSaveQuery: (title: string) => void;
	onDeleteQuery: (id: string) => void;
	onSelectQuery: (sql: string) => void;
}

export function SqlDrawerSavedTab({
	currentQuery,
	savedQueries,
	onSaveQuery,
	onDeleteQuery,
	onSelectQuery,
}: SqlDrawerSavedTabProps) {
	const { t } = useI18n();
	const [newTitle, setNewTitle] = useState('');
	const [showAddForm, setShowAddForm] = useState(false);

	const handleSaveClick = () => {
		if (!currentQuery.trim() || !newTitle.trim()) return;
		onSaveQuery(newTitle.trim());
		setNewTitle('');
		setShowAddForm(false);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
			{!showAddForm ? (
				<button
					type="button"
					onClick={() => setShowAddForm(true)}
					disabled={!currentQuery.trim()}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '6px',
						padding: '8px',
						borderRadius: '6px',
						fontSize: '11.5px',
						fontWeight: 600,
						background: 'var(--accent)',
						color: 'var(--accent-contrast)',
						border: 'none',
						cursor: currentQuery.trim() ? 'pointer' : 'not-allowed',
						opacity: currentQuery.trim() ? 1 : 0.6,
					}}
				>
					<Plus size={13} />
					<span>{t('dbSqlSavedSaveCurrent')}</span>
				</button>
			) : (
				<div
					style={{
						padding: '10px',
						borderRadius: '8px',
						background: 'var(--fill-soft)',
						border: '1px solid var(--window-border)',
						display: 'flex',
						flexDirection: 'column',
						gap: '8px',
					}}
				>
					<input
						type="text"
						placeholder={t('dbSqlSavedTitlePlaceholder')}
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						style={{
							padding: '6px 8px',
							borderRadius: '5px',
							background: 'var(--input-bg)',
							border: '1px solid var(--window-border)',
							color: 'inherit',
							fontSize: '11.5px',
						}}
					/>
					<div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
						<button
							type="button"
							onClick={() => setShowAddForm(false)}
							style={{
								padding: '4px 8px',
								borderRadius: '4px',
								background: 'transparent',
								border: '1px solid var(--window-border)',
								color: 'inherit',
								fontSize: '11px',
								cursor: 'pointer',
							}}
						>
							{t('cancel')}
						</button>
						<button
							type="button"
							onClick={handleSaveClick}
							style={{
								padding: '4px 10px',
								borderRadius: '4px',
								background: 'var(--accent)',
								color: 'var(--accent-contrast)',
								border: 'none',
								fontSize: '11px',
								fontWeight: 600,
								cursor: 'pointer',
							}}
						>
							{t('save')}
						</button>
					</div>
				</div>
			)}

			{savedQueries.length === 0 ? (
				<div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', padding: '24px 0' }}>
					{t('dbSqlSavedEmpty')}
				</div>
			) : (
				savedQueries.map((sq) => (
					<div
						key={sq.id}
						style={{
							padding: '10px 12px',
							borderRadius: '8px',
							background: 'var(--fill-softer)',
							border: '1px solid var(--window-border)',
							display: 'flex',
							flexDirection: 'column',
							gap: '6px',
						}}
					>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span style={{ fontSize: '12px', fontWeight: 700 }}>{sq.title}</span>
							<button
								type="button"
								onClick={() => onDeleteQuery(sq.id)}
								style={{
									background: 'transparent',
									border: 'none',
									color: 'var(--danger)',
									cursor: 'pointer',
									padding: '2px',
									opacity: 0.7,
								}}
							>
								<Trash2 size={12} />
							</button>
						</div>
						<div
							style={{
								fontSize: '10.5px',
								fontFamily: 'monospace',
								opacity: 0.65,
								whiteSpace: 'nowrap',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
							}}
						>
							{sq.sql}
						</div>
						<button
							type="button"
							onClick={() => onSelectQuery(sq.sql)}
							style={{
								alignSelf: 'flex-start',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
								marginTop: '4px',
								padding: '3px 8px',
								borderRadius: '4px',
								fontSize: '10.5px',
								fontWeight: 600,
								background: 'var(--accent)',
								color: 'var(--accent-contrast)',
								border: 'none',
								cursor: 'pointer',
							}}
						>
							<Play size={9} fill="currentColor" />
							<span>{t('dbSqlSavedUse')}</span>
						</button>
					</div>
				))
			)}
		</div>
	);
}
