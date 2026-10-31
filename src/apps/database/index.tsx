'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Database, Terminal, ShieldAlert, GitFork, ShieldCheck } from 'lucide-react';
import { useSession } from '@/core/session';
import { useTheme } from '@/core/theme';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import { DatabaseTwoFactorPrompt } from './components/DatabaseTwoFactorPrompt';
import { DatabaseTableList } from './components/DatabaseTableList';
import { DatabaseGrid } from './components/DatabaseGrid';
import { DatabasePendingBar } from './components/DatabasePendingBar';
import { DatabaseSqlConsole } from './components/DatabaseSqlConsole';
import { DatabaseRowDrawer } from './components/DatabaseRowDrawer';
import { DatabaseImportModal } from './components/DatabaseImportModal';
import { DatabaseCreateTableModal } from './components/DatabaseCreateTableModal';
import { DatabaseSchemaGraph } from './components/DatabaseSchemaGraph';
import { DatabaseAuditView } from './components/DatabaseAuditView';
import type { TableSummary, TableDataResponse, PendingCellChange, FilterRule } from './types';
import s from './Database.module.css';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function DatabaseApp() {
	const { currentUser, isAdmin, canUseApp } = useSession();
	const { isDark } = useTheme();
	const { t } = useI18n();
	const dialog = useDialog();

	const isLight = !isDark;
	const isAllowed = isAdmin || canUseApp('database');
	const twoFactorEnabled = Boolean(currentUser?.twoFactorEnabled);
	const passkeySession = currentUser?.authMethod === 'passkey';

	const [is2FaVerified, setIs2FaVerified] = useState(false);
	const [dbToken, setDbToken] = useState<string>('');
	const [idleExpired, setIdleExpired] = useState(false);

	// Tabs: 'tables' | 'sql' | 'schema' | 'audit'
	const [activeTab, setActiveTab] = useState<'tables' | 'sql' | 'schema' | 'audit'>('tables');

	// Tables and Data state
	const [tables, setTables] = useState<TableSummary[]>([]);
	const [selectedTable, setSelectedTable] = useState<string | null>(null);
	const [isTablesLoading, setIsTablesLoading] = useState(false);

	const [tableData, setTableData] = useState<TableDataResponse | null>(null);
	const [isDataLoading, setIsDataLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	const [searchQuery, setSearchQuery] = useState('');
	const [sortColumn, setSortColumn] = useState('');
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

	// Advanced Multi-column filters & Column visibility
	const [filters, setFilters] = useState<FilterRule[]>([]);
	const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

	// Modals and Drawers
	const [activeRowForDrawer, setActiveRowForDrawer] = useState<Record<string, unknown> | null>(null);
	const [showImportModal, setShowImportModal] = useState(false);
	const [showCreateTableModal, setShowCreateTableModal] = useState(false);

	// Pending cell modifications
	const [pendingChanges, setPendingChanges] = useState<PendingCellChange[]>([]);
	const [isSaving, setIsSaving] = useState(false);

	// 30m Inactivity Timeout handling
	const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

	const resetIdleTimer = useCallback(() => {
		if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
		idleTimerRef.current = setTimeout(() => {
			setIs2FaVerified(false);
			setDbToken('');
			setIdleExpired(true);
		}, IDLE_TIMEOUT_MS);
	}, []);

	useEffect(() => {
		if (is2FaVerified) {
			resetIdleTimer();
			const handleActivity = () => resetIdleTimer();
			window.addEventListener('keydown', handleActivity);
			window.addEventListener('mousedown', handleActivity);
			return () => {
				if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
				window.removeEventListener('keydown', handleActivity);
				window.removeEventListener('mousedown', handleActivity);
			};
		}
	}, [is2FaVerified, resetIdleTimer]);

	// Fetch table list
	const fetchTables = useCallback(async () => {
		if (!dbToken) return;
		setIsTablesLoading(true);
		try {
			const res = await fetch('/api/database/tables', {
				headers: { 'x-db-token': dbToken },
			});
			if (res.ok) {
				const data = await res.json();
				const nextTables = Array.isArray(data.tables)
					? data.tables.filter(
							(t: unknown): t is TableSummary =>
								Boolean(t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string')
						)
					: [];
				setTables(nextTables);
				if (!selectedTable && nextTables.length > 0) {
					setSelectedTable(nextTables[0].name);
				}
			} else if (res.status === 401) {
				setIs2FaVerified(false);
				setDbToken('');
				setIdleExpired(true);
			}
		} catch (err) {
			console.error('Failed to load tables:', err);
		} finally {
			setIsTablesLoading(false);
		}
	}, [dbToken, selectedTable]);

	// Fetch table data
	const fetchTableData = useCallback(async () => {
		if (!dbToken || !selectedTable) return;
		setIsDataLoading(true);
		try {
			const params = new URLSearchParams({
				table: selectedTable,
				page: String(page),
				limit: String(pageSize),
			});
			if (searchQuery) params.set('search', searchQuery);
			if (sortColumn) {
				params.set('sort', sortColumn);
				params.set('order', sortOrder);
			}
			if (filters.length > 0) {
				params.set('filters', JSON.stringify(filters));
			}

			const res = await fetch(`/api/database/data?${params.toString()}`, {
				headers: { 'x-db-token': dbToken },
			});
			if (res.ok) {
				const data = await res.json();
				setTableData(data);
			} else if (res.status === 401) {
				setIs2FaVerified(false);
				setDbToken('');
				setIdleExpired(true);
			}
		} catch (err) {
			console.error(`Failed to load data for ${selectedTable}:`, err);
		} finally {
			setIsDataLoading(false);
		}
	}, [dbToken, selectedTable, page, pageSize, searchQuery, sortColumn, sortOrder, filters]);

	// Initial fetch when verified
	useEffect(() => {
		if (is2FaVerified && dbToken) {
			void fetchTables();
		}
	}, [is2FaVerified, dbToken, fetchTables]);

	// Fetch data when table or query params change
	useEffect(() => {
		if (is2FaVerified && dbToken && selectedTable) {
			void fetchTableData();
		}
	}, [is2FaVerified, dbToken, selectedTable, fetchTableData]);

	// A passkey session is already multi-factor; obtain the short-lived database
	// token directly. If this fails, the prompt offers the same action again.
	const handlePasskeySubmit = useCallback(async () => {
		try {
			const res = await fetch('/api/database/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ method: 'passkey' }),
			});
			const data = await res.json();
			if (res.ok && data.token) {
				setDbToken(data.token);
				setIs2FaVerified(true);
				setIdleExpired(false);
				return { ok: true };
			}
			return { ok: false, error: data.error };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : t('connError') };
		}
	}, [t]);

	useEffect(() => {
		if (passkeySession && !is2FaVerified) {
			void handlePasskeySubmit();
		}
	}, [passkeySession, is2FaVerified, handlePasskeySubmit]);

	// Handle 2FA verification submission
	const handleTwoFactorSubmit = async (code: string) => {
		try {
			const res = await fetch('/api/database/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			});

			const data = await res.json();
			if (res.ok && data.token) {
				setDbToken(data.token);
				setIs2FaVerified(true);
				setIdleExpired(false);
				return { ok: true };
			}
			return { ok: false, error: data.error };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : t('connError') };
		}
	};

	// Switch table: warn if pending unsaved edits exist
	const handleSelectTable = async (name: string) => {
		if (pendingChanges.length > 0) {
			const discard = await dialog.confirm({
				title: t('dbUnsavedChanges'),
				message: t('dbUnsavedChangesPrompt'),
				tone: 'warning',
			});
			if (!discard) return;
		}

		setPendingChanges([]);
		setSelectedTable(name);
		setTableData(null);
		setPage(1);
		setSearchQuery('');
		setSortColumn('');
		setFilters([]);
		setActiveRowForDrawer(null);
	};

	// Jump to Foreign Key Target row
	const handleJumpToForeignKey = (foreignTable: string, foreignCol: string, value: unknown) => {
		setSelectedTable(foreignTable);
		setFilters([
			{
				id: 'fk_' + Date.now(),
				column: foreignCol,
				op: '=',
				value: String(value),
			},
		]);
		setActiveTab('tables');
		setActiveRowForDrawer(null);
		setPage(1);
	};

	// Filter rules handlers
	const handleAddFilter = (initial?: Partial<FilterRule>) => {
		const firstCol = tableData?.columns[0]?.name || 'id';
		setFilters((prev) => [
			...prev,
			{
				id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
				column: initial?.column || firstCol,
				op: initial?.op || '=',
				value: initial?.value ?? '',
			},
		]);
	};

	const handleUpdateFilter = (id: string, updated: Partial<FilterRule>) => {
		setFilters((prev) =>
			prev.map((f) => (f.id === id ? { ...f, ...updated } : f))
		);
	};

	const handleRemoveFilter = (id: string) => {
		setFilters((prev) => prev.filter((f) => f.id !== id));
	};

	const handleClearFilters = () => {
		setFilters([]);
	};

	// Column visibility handlers
	const handleToggleColumnVisibility = (colName: string) => {
		setHiddenColumns((prev) => {
			const next = new Set(prev);
			if (next.has(colName)) next.delete(colName);
			else next.add(colName);
			return next;
		});
	};

	const handleShowAllColumns = () => {
		setHiddenColumns(new Set());
	};

	// Handle individual cell change
	const handleCellChange = (change: PendingCellChange) => {
		setPendingChanges((prev) => {
			const filtered = prev.filter(
				(c) =>
					!(String(c.rowPkVal) === String(change.rowPkVal) && c.columnName === change.columnName)
			);
			return [...filtered, change];
		});
	};

	// Save all pending cell modifications
	const handleBatchSave = async () => {
		if (!selectedTable || pendingChanges.length === 0 || isSaving) return;

		const confirmed = await dialog.confirm({
			title: t('dbApplyConfirm'),
			message: fill(t('dbApplyConfirmPrompt'), { table: selectedTable, n: pendingChanges.length }),
			tone: 'warning',
		});

		if (!confirmed) return;

		setIsSaving(true);
		try {
			// Group by rowPkVal and capture both previous and new values for audit diffs
			const rowMap = new Map<
				unknown,
				{ pkCol: string; changes: Record<string, unknown>; previous: Record<string, unknown> }
			>();
			for (const c of pendingChanges) {
				if (!rowMap.has(c.rowPkVal)) {
					rowMap.set(c.rowPkVal, { pkCol: c.rowPkCol, changes: {}, previous: {} });
				}
				rowMap.get(c.rowPkVal)!.changes[c.columnName] = c.newValue;
				rowMap.get(c.rowPkVal)!.previous[c.columnName] = c.originalValue;
			}

			const updates = Array.from(rowMap.entries()).map(([val, info]) => ({
				pk: { col: info.pkCol, val },
				changes: info.changes,
				previous: info.previous,
			}));

			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({
					table: selectedTable,
					updates,
				}),
			});

			const data = await res.json();
			if (res.ok) {
				setPendingChanges([]);
				await dialog.alert({
					title: t('success'),
					message: data.message || t('dbSavedSuccess'),
				});
				void fetchTableData();
				void fetchTables();
			} else {
				await dialog.alert({
					title: t('error'),
					message: data.error || t('dbSaveFailed'),
				});
			}
		} catch (err) {
			await dialog.alert({
				title: t('error'),
				message: err instanceof Error ? err.message : t('dbConnectionError'),
			});
		} finally {
			setIsSaving(false);
		}
	};

	// Handle row drawer quick save
	const handleSaveRowDrawer = async (changedValues: Record<string, unknown>) => {
		if (!activeRowForDrawer || !selectedTable || Object.keys(changedValues).length === 0) {
			setActiveRowForDrawer(null);
			return;
		}

		const pkCol =
			tableData?.primaryKey ||
			tables.find((t) => t.name === selectedTable)?.primaryKey ||
			'id';
		const pkVal = activeRowForDrawer[pkCol];

		const previousValues: Record<string, unknown> = {};
		for (const key of Object.keys(changedValues)) {
			previousValues[key] = activeRowForDrawer[key];
		}

		try {
			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({
					table: selectedTable,
					updates: [
						{
							pk: { col: pkCol, val: pkVal },
							changes: changedValues,
							previous: previousValues,
						},
					],
				}),
			});

			const data = await res.json();
			if (res.ok) {
				await dialog.alert({
					title: t('success'),
					message: 'Satır başarıyla güncellendi.',
				});
				setActiveRowForDrawer(null);
				void fetchTableData();
			} else {
				await dialog.alert({
					title: t('error'),
					message: data.error || 'Satır güncellenemedi.',
				});
			}
		} catch (err) {
			console.error('Drawer save error:', err);
		}
	};

	// Handle row deletion
	const handleDeleteRows = async (rowPks: unknown[]) => {
		if (!selectedTable || rowPks.length === 0) return;
		const pkCol =
			tableData?.primaryKey ||
			tables.find((t) => t.name === selectedTable)?.primaryKey ||
			'id';

		try {
			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({
					table: selectedTable,
					deletes: rowPks.map((val) => ({ col: pkCol, val })),
				}),
			});

			if (res.ok) {
				void fetchTableData();
				void fetchTables();
			} else {
				const data = await res.json();
				await dialog.alert({
					title: t('dbDeleteFailed'),
					message: data.error || t('dbDeleteFailed'),
				});
			}
		} catch (err) {
			console.error('Delete error:', err);
		}
	};

	// Handle new row insert
	const handleInsertRow = async (row: Record<string, unknown>) => {
		if (!selectedTable) return;

		try {
			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({
					table: selectedTable,
					inserts: [row],
				}),
			});

			if (res.ok) {
				void fetchTableData();
				void fetchTables();
			} else {
				const data = await res.json();
				await dialog.alert({
					title: t('dbInsertFailed'),
					message: data.error || t('dbInsertFailed'),
				});
			}
		} catch (err) {
			console.error('Insert error:', err);
		}
	};

	// Not admin guard
	if (!isAllowed) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24, textAlign: 'center' }}>
				<ShieldAlert size={42} color="#ff453a" />
				<h3 style={{ margin: 0, fontSize: 16 }}>{t('dbAdminPrivilegeRequired')}</h3>
				<p style={{ margin: 0, fontSize: 13, opacity: 0.7, maxWidth: 360 }}>
					{t('dbAdminOnlyDesc')}
				</p>
			</div>
		);
	}

	// 2FA Security Gate
	if (!is2FaVerified) {
		return (
			<DatabaseTwoFactorPrompt
				isLight={isLight}
				twoFactorEnabled={twoFactorEnabled}
				passkeySession={passkeySession}
				idleExpired={idleExpired}
				onSubmit={handleTwoFactorSubmit}
				onPasskey={handlePasskeySubmit}
			/>
		);
	}

	const currentPk =
		tableData?.primaryKey ||
		tables.find((t) => t.name === (tableData?.table || selectedTable))?.primaryKey ||
		'id';

	return (
		<div className={s.container}>
			{/* Left Sidebar: Tables List (Only in tables view or when relevant) */}
			{activeTab === 'tables' && (
				<DatabaseTableList
					tables={tables}
					selectedTable={selectedTable}
					isLoading={isTablesLoading}
					onSelectTable={handleSelectTable}
					onRefresh={fetchTables}
					onOpenCreateTable={() => setShowCreateTableModal(true)}
				/>
			)}

			{/* Main Workspace Area */}
			<div className={s.main} style={{ position: 'relative' }}>
				{/* Top 4-Tab Switcher */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '8px 16px',
						background: 'var(--fill-softer)',
						borderBottom: '1px solid var(--window-border)',
						flexWrap: 'wrap',
						gap: '8px',
					}}
				>
					<div className={s.tabGroup} style={{ flexWrap: 'wrap' }}>
						<button
							type="button"
							className={`${s.tabBtn} ${activeTab === 'tables' ? s.tabBtnActive : ''}`}
							onClick={() => setActiveTab('tables')}
						>
							<Database size={13} />
							<span>{t('dbTablesGridTab') || 'Tablo Masası'}</span>
						</button>
						<button
							type="button"
							className={`${s.tabBtn} ${activeTab === 'sql' ? s.tabBtnActive : ''}`}
							onClick={() => setActiveTab('sql')}
						>
							<Terminal size={13} />
							<span>{t('dbSqlConsoleTab') || 'SQL Laboratuvarı'}</span>
						</button>
						<button
							type="button"
							className={`${s.tabBtn} ${activeTab === 'schema' ? s.tabBtnActive : ''}`}
							onClick={() => setActiveTab('schema')}
						>
							<GitFork size={13} />
							<span>{t('dbSchemaTab') || 'ER Şeması & DDL'}</span>
						</button>
						<button
							type="button"
							className={`${s.tabBtn} ${activeTab === 'audit' ? s.tabBtnActive : ''}`}
							onClick={() => setActiveTab('audit')}
						>
							<ShieldCheck size={13} />
							<span>{t('dbAuditTab') || 'Güvenlik & Denetim'}</span>
						</button>
					</div>

					<div style={{ fontSize: 11, opacity: 0.6 }}>
						{t('db2faSessionActive')} · 30m
					</div>
				</div>

				{/* 1. TABLO MASASI (GRID) */}
				{activeTab === 'tables' && (
					<>
						<DatabaseGrid
							key={tableData?.table || selectedTable || 'empty'}
							data={tableData}
							isLoading={isDataLoading}
							primaryKey={currentPk}
							pendingChanges={pendingChanges}
							onCellChange={handleCellChange}
							onDeleteRows={handleDeleteRows}
							onInsertRow={handleInsertRow}
							onRefresh={fetchTableData}
							onPageChange={(newPage) => setPage(newPage)}
							pageSize={pageSize}
							onPageSizeChange={(newSize) => {
								setPageSize(newSize);
								setPage(1);
							}}
							onSearchChange={(query) => {
								setSearchQuery(query);
								setPage(1);
							}}
							onSortChange={(col) => {
								if (sortColumn === col) {
									setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
								} else {
									setSortColumn(col);
									setSortOrder('asc');
								}
							}}
							sortColumn={sortColumn}
							sortOrder={sortOrder}
							// Advanced features
							filters={filters}
							onAddFilter={handleAddFilter}
							onUpdateFilter={handleUpdateFilter}
							onRemoveFilter={handleRemoveFilter}
							onClearFilters={handleClearFilters}
							hiddenColumns={hiddenColumns}
							onToggleColumnVisibility={handleToggleColumnVisibility}
							onShowAllColumns={handleShowAllColumns}
							onJumpToForeignKey={handleJumpToForeignKey}
							onOpenImport={() => setShowImportModal(true)}
							onOpenRowDrawer={(row) => setActiveRowForDrawer(row)}
						/>

						{/* Floating Batch Save Bar */}
						<DatabasePendingBar
							pendingChanges={pendingChanges}
							isSaving={isSaving}
							onDiscard={() => setPendingChanges([])}
							onSave={handleBatchSave}
						/>

						{/* Row & JSON Detail Drawer */}
						{activeRowForDrawer && tableData && (
							<DatabaseRowDrawer
								row={activeRowForDrawer}
								columns={tableData.columns}
								tableName={selectedTable || ''}
								onClose={() => setActiveRowForDrawer(null)}
								onSave={handleSaveRowDrawer}
								onJumpToForeignKey={handleJumpToForeignKey}
							/>
						)}
					</>
				)}

				{/* 2. SQL LABORATUVARI */}
				{activeTab === 'sql' && (
					<DatabaseSqlConsole
						dbToken={dbToken}
						onQueryExecuted={() => {
							void fetchTables();
							if (selectedTable) void fetchTableData();
						}}
					/>
				)}

				{/* 3. GÖRSEL ER ŞEMASI & DDL */}
				{activeTab === 'schema' && (
					<DatabaseSchemaGraph
						dbToken={dbToken}
						onSelectTable={(tableName) => {
							void handleSelectTable(tableName);
							setActiveTab('tables');
						}}
						onOpenCreateTable={() => setShowCreateTableModal(true)}
					/>
				)}

				{/* 4. GÜVENLİK & DENETİM (AUDIT & REVERT) */}
				{activeTab === 'audit' && (
					<DatabaseAuditView
						dbToken={dbToken}
						onRevertSuccess={() => {
							if (selectedTable) void fetchTableData();
						}}
					/>
				)}

				{/* 3-Step Smart Import Modal */}
				{showImportModal && selectedTable && tableData && (
					<DatabaseImportModal
						tableName={selectedTable}
						columns={tableData.columns}
						dbToken={dbToken}
						onClose={() => setShowImportModal(false)}
						onSuccess={() => {
							setShowImportModal(false);
							void fetchTableData();
							void fetchTables();
						}}
					/>
				)}

				{/* Visual Create Table DDL Modal */}
				{showCreateTableModal && (
					<DatabaseCreateTableModal
						dbToken={dbToken}
						onClose={() => setShowCreateTableModal(false)}
						onSuccess={() => {
							setShowCreateTableModal(false);
							void fetchTables();
						}}
					/>
				)}
			</div>
		</div>
	);
}
