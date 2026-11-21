'use client';

import React, { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useSession } from '@/core/session';
import { useTheme } from '@/core/theme';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useDatabaseAuth } from './hooks/useDatabaseAuth';
import { useDatabaseTables } from './hooks/useDatabaseTables';
import { useDatabaseMutations } from './hooks/useDatabaseMutations';
import { DatabaseTwoFactorPrompt } from './components/DatabaseTwoFactorPrompt';
import { DatabaseTableList } from './components/DatabaseTableList';
import { DatabaseWorkspaceTabs, type DatabaseWorkspaceTab } from './components/DatabaseWorkspaceTabs';
import { DatabaseGrid } from './components/DatabaseGrid';
import { DatabasePendingBar } from './components/DatabasePendingBar';
import { DatabaseRowDrawer } from './components/DatabaseRowDrawer';
import { DatabaseSecondaryViews } from './components/DatabaseSecondaryViews';
import s from './Database.module.css';

export function DatabaseApp() {
	const { currentUser, isAdmin, canUseApp } = useSession();
	const { isDark } = useTheme();
	const { t } = useI18n();
	const dialog = useDialog();

	const isLight = !isDark;
	const isAllowed = isAdmin || canUseApp('database');
	const twoFactorEnabled = Boolean(currentUser?.twoFactorEnabled);
	const passkeySession = currentUser?.authMethod === 'passkey';

	const [activeTab, setActiveTab] = useState<DatabaseWorkspaceTab>('tables');
	const [activeRowForDrawer, setActiveRowForDrawer] = useState<Record<string, unknown> | null>(null);
	const [showImportModal, setShowImportModal] = useState(false);
	const [showCreateTableModal, setShowCreateTableModal] = useState(false);

	const auth = useDatabaseAuth({
		passkeySession,
		connErrorText: t('connError'),
	});

	const browser = useDatabaseTables({
		is2FaVerified: auth.is2FaVerified,
		dbToken: auth.dbToken,
		onUnauthorized: auth.expireSession,
	});

	const mutations = useDatabaseMutations({
		dbToken: auth.dbToken,
		selectedTable: browser.selectedTable,
		tableData: browser.tableData,
		tables: browser.tables,
		onRefreshData: () => void browser.fetchTableData(),
		onRefreshTables: () => void browser.fetchTables(),
	});

	const handleSelectTable = async (name: string) => {
		if (mutations.pendingChanges.length > 0) {
			const discard = await dialog.confirm({
				title: t('dbUnsavedChanges'),
				message: t('dbUnsavedChangesPrompt'),
				tone: 'warning',
			});
			if (!discard) return;
		}
		mutations.clearPendingChanges();
		browser.applyTableSelection(name);
		setActiveRowForDrawer(null);
	};

	const handleJumpToForeignKey = (foreignTable: string, foreignCol: string, value: unknown) => {
		browser.applyForeignKeyFilter(foreignTable, foreignCol, value);
		setActiveTab('tables');
		setActiveRowForDrawer(null);
	};

	if (!isAllowed) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24, textAlign: 'center' }}>
				<ShieldAlert size={42} color="var(--danger)" />
				<h3 style={{ margin: 0, fontSize: 16 }}>{t('dbAdminPrivilegeRequired')}</h3>
				<p style={{ margin: 0, fontSize: 13, opacity: 0.7, maxWidth: 360 }}>
					{t('dbAdminOnlyDesc')}
				</p>
			</div>
		);
	}

	if (!auth.is2FaVerified && auth.isAutoUnlocking) {
		return (
			<div className={s.container} style={{ alignItems: 'center', justifyContent: 'center', gap: 10 }}>
				<Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
				<span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('loading')}</span>
			</div>
		);
	}

	if (!auth.is2FaVerified) {
		return (
			<DatabaseTwoFactorPrompt
				isLight={isLight}
				twoFactorEnabled={twoFactorEnabled}
				passkeySession={passkeySession}
				idleExpired={auth.idleExpired}
				initialError={auth.autoUnlockError}
				onSubmit={auth.handleTwoFactorSubmit}
				onPasskey={auth.handlePasskeySubmit}
			/>
		);
	}

	const currentPk =
		browser.tableData?.primaryKey ||
		browser.tables.find((tbl) => tbl.name === (browser.tableData?.table || browser.selectedTable))?.primaryKey ||
		'id';

	return (
		<div className={s.container}>
			{activeTab === 'tables' && (
				<DatabaseTableList
					tables={browser.tables}
					selectedTable={browser.selectedTable}
					isLoading={browser.isTablesLoading}
					onSelectTable={handleSelectTable}
					onRefresh={browser.fetchTables}
					onOpenCreateTable={() => setShowCreateTableModal(true)}
				/>
			)}

			<div className={s.main} style={{ position: 'relative' }}>
				<DatabaseWorkspaceTabs activeTab={activeTab} onSelectTab={setActiveTab} />

				{activeTab === 'tables' && (
					<>
						<DatabaseGrid
							key={browser.tableData?.table || browser.selectedTable || 'empty'}
							data={browser.tableData}
							isLoading={browser.isDataLoading}
							primaryKey={currentPk}
							pendingChanges={mutations.pendingChanges}
							onCellChange={mutations.handleCellChange}
							onDeleteRows={mutations.handleDeleteRows}
							onInsertRow={mutations.handleInsertRow}
							onRefresh={browser.fetchTableData}
							onPageChange={(newPage) => browser.setPage(newPage)}
							pageSize={browser.pageSize}
							onPageSizeChange={browser.handlePageSizeChange}
							onSearchChange={browser.handleSearchChange}
							onSortChange={browser.handleSortChange}
							sortColumn={browser.sortColumn}
							sortOrder={browser.sortOrder}
							filters={browser.filters}
							onAddFilter={browser.handleAddFilter}
							onUpdateFilter={browser.handleUpdateFilter}
							onRemoveFilter={browser.handleRemoveFilter}
							onClearFilters={browser.handleClearFilters}
							hiddenColumns={browser.hiddenColumns}
							onToggleColumnVisibility={browser.handleToggleColumnVisibility}
							onShowAllColumns={browser.handleShowAllColumns}
							onJumpToForeignKey={handleJumpToForeignKey}
							onOpenImport={() => setShowImportModal(true)}
							onOpenRowDrawer={(row) => setActiveRowForDrawer(row)}
						/>

						<DatabasePendingBar
							pendingChanges={mutations.pendingChanges}
							isSaving={mutations.isSaving}
							onDiscard={mutations.clearPendingChanges}
							onSave={mutations.handleBatchSave}
						/>

						{activeRowForDrawer && browser.tableData && (
							<DatabaseRowDrawer
								row={activeRowForDrawer}
								columns={browser.tableData.columns}
								tableName={browser.selectedTable || ''}
								onClose={() => setActiveRowForDrawer(null)}
								onSave={(changed) =>
									mutations.handleSaveRowDrawer(activeRowForDrawer, changed, () =>
										setActiveRowForDrawer(null)
									)
								}
								onJumpToForeignKey={handleJumpToForeignKey}
							/>
						)}
					</>
				)}

				<DatabaseSecondaryViews
					activeTab={activeTab}
					dbToken={auth.dbToken}
					selectedTable={browser.selectedTable}
					tableData={browser.tableData}
					showImportModal={showImportModal}
					showCreateTableModal={showCreateTableModal}
					onRefreshTables={() => void browser.fetchTables()}
					onRefreshData={() => void browser.fetchTableData()}
					onSelectTableFromSchema={(tableName) => {
						void handleSelectTable(tableName);
						setActiveTab('tables');
					}}
					onOpenCreateTable={() => setShowCreateTableModal(true)}
					onCloseImportModal={() => setShowImportModal(false)}
					onCloseCreateTableModal={() => setShowCreateTableModal(false)}
				/>
			</div>
		</div>
	);
}
