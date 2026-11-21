'use client';

import React, { useState, useEffect } from 'react';
import { X, Bookmark, History, Sparkles, HardDrive } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import {
	clearQueryHistoryStorage,
	loadQueryHistory,
	loadSavedQueries,
	persistSavedQueries,
	type QueryHistoryItem,
	type SavedQuery,
} from '../utils/sqlStorage';
import { SQL_SYSTEM_TEMPLATES } from '../utils/sqlTemplates';
import { SqlDrawerTemplatesTab } from './sql/SqlDrawerTemplatesTab';
import { SqlDrawerSavedTab } from './sql/SqlDrawerSavedTab';
import { SqlDrawerHistoryTab } from './sql/SqlDrawerHistoryTab';
import s from '../Database.module.css';

interface DatabaseSqlDrawerProps {
	onSelectQuery: (sql: string) => void;
	onClose: () => void;
	currentQuery: string;
}

export function DatabaseSqlDrawer({
	onSelectQuery,
	onClose,
	currentQuery,
}: DatabaseSqlDrawerProps) {
	const { t } = useI18n();
	const [activeSubTab, setActiveSubTab] = useState<'templates' | 'saved' | 'history'>('templates');
	const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
	const [history, setHistory] = useState<QueryHistoryItem[]>([]);

	useEffect(() => {
		setSavedQueries(loadSavedQueries());
		setHistory(loadQueryHistory());
	}, []);

	const handleSaveCurrent = (title: string) => {
		if (!currentQuery.trim() || !title) return;
		const newItem: SavedQuery = {
			id: 'sq_' + Date.now(),
			title,
			sql: currentQuery.trim(),
			createdAt: Date.now(),
		};
		const updated = [newItem, ...savedQueries];
		setSavedQueries(updated);
		persistSavedQueries(updated);
	};

	const handleDeleteSaved = (id: string) => {
		const updated = savedQueries.filter((q) => q.id !== id);
		setSavedQueries(updated);
		persistSavedQueries(updated);
	};

	const handleClearHistory = () => {
		setHistory([]);
		clearQueryHistoryStorage();
	};

	const handlePickQuery = (sql: string) => {
		onSelectQuery(sql);
		onClose();
	};

	const tabButtonStyle = (active: boolean): React.CSSProperties => ({
		flex: 1,
		padding: '8px 0',
		border: 'none',
		borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
		background: 'transparent',
		color: active ? 'var(--accent)' : 'inherit',
		fontSize: '11.5px',
		fontWeight: active ? 700 : 500,
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '4px',
	});

	return (
		<>
			<div className={s.drawerBackdrop} onClick={onClose} />
			<div className={s.drawerPanel}>
				{/* Drawer header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '12px 16px',
						borderBottom: '1px solid var(--window-border)',
					}}
				>
					<div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
						<Sparkles size={15} color="var(--accent)" />
						<span>{t('dbSqlDrawerTitle')}</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: 'transparent',
							border: 'none',
							color: 'inherit',
							opacity: 0.7,
							cursor: 'pointer',
							padding: '4px',
						}}
					>
						<X size={16} />
					</button>
				</div>

				{/* Sub tabs */}
				<div
					style={{
						display: 'flex',
						borderBottom: '1px solid var(--window-border)',
						background: 'var(--fill-softer)',
					}}
				>
					<button
						type="button"
						onClick={() => setActiveSubTab('templates')}
						style={tabButtonStyle(activeSubTab === 'templates')}
					>
						<HardDrive size={12} />
						<span>{fill(t('dbSqlDrawerSystemTab'), { n: SQL_SYSTEM_TEMPLATES.length })}</span>
					</button>
					<button
						type="button"
						onClick={() => setActiveSubTab('saved')}
						style={tabButtonStyle(activeSubTab === 'saved')}
					>
						<Bookmark size={12} />
						<span>{fill(t('dbSqlDrawerSavedTab'), { n: savedQueries.length })}</span>
					</button>
					<button
						type="button"
						onClick={() => setActiveSubTab('history')}
						style={tabButtonStyle(activeSubTab === 'history')}
					>
						<History size={12} />
						<span>{fill(t('dbSqlDrawerHistoryTab'), { n: history.length })}</span>
					</button>
				</div>

				{/* Content area */}
				<div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
					{activeSubTab === 'templates' && (
						<SqlDrawerTemplatesTab onSelectQuery={handlePickQuery} />
					)}
					{activeSubTab === 'saved' && (
						<SqlDrawerSavedTab
							currentQuery={currentQuery}
							savedQueries={savedQueries}
							onSaveQuery={handleSaveCurrent}
							onDeleteQuery={handleDeleteSaved}
							onSelectQuery={handlePickQuery}
						/>
					)}
					{activeSubTab === 'history' && (
						<SqlDrawerHistoryTab
							history={history}
							onSelectQuery={handlePickQuery}
							onClearHistory={handleClearHistory}
						/>
					)}
				</div>
			</div>
		</>
	);
}
