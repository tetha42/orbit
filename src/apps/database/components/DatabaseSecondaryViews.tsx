'use client';

import React from 'react';
import { DatabaseSqlConsole } from './DatabaseSqlConsole';
import { DatabaseSchemaGraph } from './DatabaseSchemaGraph';
import { DatabaseAuditView } from './DatabaseAuditView';
import { DatabaseImportModal } from './DatabaseImportModal';
import { DatabaseCreateTableModal } from './DatabaseCreateTableModal';
import type { DatabaseWorkspaceTab } from './DatabaseWorkspaceTabs';
import type { TableDataResponse } from '../types';

interface DatabaseSecondaryViewsProps {
	activeTab: DatabaseWorkspaceTab;
	dbToken: string;
	selectedTable: string | null;
	tableData: TableDataResponse | null;
	showImportModal: boolean;
	showCreateTableModal: boolean;
	onRefreshTables: () => void;
	onRefreshData: () => void;
	onSelectTableFromSchema: (tableName: string) => void;
	onOpenCreateTable: () => void;
	onCloseImportModal: () => void;
	onCloseCreateTableModal: () => void;
}

export function DatabaseSecondaryViews({
	activeTab,
	dbToken,
	selectedTable,
	tableData,
	showImportModal,
	showCreateTableModal,
	onRefreshTables,
	onRefreshData,
	onSelectTableFromSchema,
	onOpenCreateTable,
	onCloseImportModal,
	onCloseCreateTableModal,
}: DatabaseSecondaryViewsProps) {
	return (
		<>
			{/* SQL Query Console */}
			{activeTab === 'sql' && (
				<DatabaseSqlConsole
					dbToken={dbToken}
					onQueryExecuted={() => {
						onRefreshTables();
						if (selectedTable) onRefreshData();
					}}
				/>
			)}

			{/* Visual ER Schema & DDL */}
			{activeTab === 'schema' && (
				<DatabaseSchemaGraph
					dbToken={dbToken}
					onSelectTable={onSelectTableFromSchema}
					onOpenCreateTable={onOpenCreateTable}
				/>
			)}

			{/* Security & Audit Diff */}
			{activeTab === 'audit' && (
				<DatabaseAuditView
					dbToken={dbToken}
					onRevertSuccess={() => {
						if (selectedTable) onRefreshData();
					}}
				/>
			)}

			{/* 3-Step Smart Import Modal */}
			{showImportModal && selectedTable && tableData && (
				<DatabaseImportModal
					tableName={selectedTable}
					columns={tableData.columns}
					dbToken={dbToken}
					onClose={onCloseImportModal}
					onSuccess={() => {
						onCloseImportModal();
						onRefreshData();
						onRefreshTables();
					}}
				/>
			)}

			{/* Visual Create Table DDL Modal */}
			{showCreateTableModal && (
				<DatabaseCreateTableModal
					dbToken={dbToken}
					onClose={onCloseCreateTableModal}
					onSuccess={() => {
						onCloseCreateTableModal();
						onRefreshTables();
					}}
				/>
			)}
		</>
	);
}
