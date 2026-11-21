'use client';

import React from 'react';
import { Database, Terminal, GitFork, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from '../Database.module.css';

export type DatabaseWorkspaceTab = 'tables' | 'sql' | 'schema' | 'audit';

interface DatabaseWorkspaceTabsProps {
	activeTab: DatabaseWorkspaceTab;
	onSelectTab: (tab: DatabaseWorkspaceTab) => void;
}

export function DatabaseWorkspaceTabs({
	activeTab,
	onSelectTab,
}: DatabaseWorkspaceTabsProps) {
	const { t } = useI18n();

	return (
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
					onClick={() => onSelectTab('tables')}
				>
					<Database size={13} />
					<span>{t('dbTablesGridTab')}</span>
				</button>
				<button
					type="button"
					className={`${s.tabBtn} ${activeTab === 'sql' ? s.tabBtnActive : ''}`}
					onClick={() => onSelectTab('sql')}
				>
					<Terminal size={13} />
					<span>{t('dbSqlConsoleTab')}</span>
				</button>
				<button
					type="button"
					className={`${s.tabBtn} ${activeTab === 'schema' ? s.tabBtnActive : ''}`}
					onClick={() => onSelectTab('schema')}
				>
					<GitFork size={13} />
					<span>{t('dbSchemaTab')}</span>
				</button>
				<button
					type="button"
					className={`${s.tabBtn} ${activeTab === 'audit' ? s.tabBtnActive : ''}`}
					onClick={() => onSelectTab('audit')}
				>
					<ShieldCheck size={13} />
					<span>{t('dbAuditTab')}</span>
				</button>
			</div>

			<div style={{ fontSize: 11, opacity: 0.6 }}>
				{t('db2faSessionActive')} · 30m
			</div>
		</div>
	);
}
