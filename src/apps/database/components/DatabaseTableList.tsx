'use client';

import React, { useState } from 'react';
import { Table, RefreshCw, Search, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { TableSummary } from '../types';
import s from '../Database.module.css';

interface DatabaseTableListProps {
	tables: TableSummary[];
	selectedTable: string | null;
	isLoading: boolean;
	onSelectTable: (name: string) => void;
	onRefresh: () => void;
	onOpenCreateTable?: () => void;
}

export function DatabaseTableList({
	tables,
	selectedTable,
	isLoading,
	onSelectTable,
	onRefresh,
	onOpenCreateTable,
}: DatabaseTableListProps) {
	const { t } = useI18n();
	const [filter, setFilter] = useState('');

	// The API is the source of truth, but a transient/partial response must never
	// crash the whole Database window: ignore malformed entries defensively.
	const safeTables = tables.filter(
		(t): t is TableSummary => Boolean(t && typeof t.name === 'string')
	);
	const needle = filter.toLowerCase().trim();
	const filtered = safeTables.filter((t) => t.name.toLowerCase().includes(needle));

	return (
		<aside className={s.sidebar}>
			<div className={s.sidebarHeader}>
				<div className={s.sidebarTitle}>
					<span>{fill(t('dbTables'), { n: safeTables.length })}</span>
					<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
						{onOpenCreateTable && (
							<button
								type="button"
								onClick={onOpenCreateTable}
								style={{
									background: 'transparent',
									border: 'none',
									color: 'var(--accent, #3b82f6)',
									cursor: 'pointer',
									padding: '2px',
									display: 'flex',
									alignItems: 'center',
									opacity: 0.85,
								}}
								title="Yeni Tablo Oluştur"
							>
								<Plus size={14} />
							</button>
						)}
						<button
							type="button"
							onClick={onRefresh}
							disabled={isLoading}
							style={{
								background: 'transparent',
								border: 'none',
								color: 'inherit',
								cursor: 'pointer',
								padding: '2px',
								display: 'flex',
								alignItems: 'center',
								opacity: isLoading ? 0.4 : 0.7,
							}}
							title={t('refresh')}
						>
							<RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
						</button>
					</div>
				</div>
				<div style={{ position: 'relative' }}>
					<input
						type="text"
						className={s.searchInput}
						placeholder={t('dbSearchTable')}
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
					/>
					<Search
						size={12}
						style={{
							position: 'absolute',
							right: 8,
							top: '50%',
							transform: 'translateY(-50%)',
							opacity: 0.4,
							pointerEvents: 'none',
						}}
					/>
				</div>
			</div>

			<div className={s.tableList}>
				{filtered.map((t) => {
					const isActive = selectedTable === t.name;
					return (
						<button
							key={t.name}
							type="button"
							className={`${s.tableItem} ${isActive ? s.tableItemActive : ''}`}
							onClick={() => onSelectTable(t.name)}
						>
							<span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
								<Table size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
								<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{t.name}
								</span>
							</span>
							<span className={s.rowCountBadge}>{t.rowCount}</span>
						</button>
					);
				})}

				{filtered.length === 0 && (
					<div style={{ padding: '16px', fontSize: 11, opacity: 0.5, textAlign: 'center' }}>
						{t('noResults')}
					</div>
				)}
			</div>
		</aside>
	);
}
