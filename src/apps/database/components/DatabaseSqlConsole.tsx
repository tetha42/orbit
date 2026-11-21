'use client';

import React, { useState } from 'react';
import { Play, Loader2, Sparkles, Activity } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { appendQueryHistory } from '../utils/sqlStorage';
import { DatabaseSqlDrawer } from './DatabaseSqlDrawer';
import { DatabaseSafeModeModal } from './DatabaseSafeModeModal';
import { SqlResultPanel } from './sql/SqlResultPanel';
import type { QueryResult } from '../types';
import s from '../Database.module.css';

interface DatabaseSqlConsoleProps {
	dbToken: string;
	onQueryExecuted?: () => void;
}

export function DatabaseSqlConsole({ dbToken, onQueryExecuted }: DatabaseSqlConsoleProps) {
	const { t } = useI18n();
	const [query, setQuery] = useState('SELECT * FROM users ORDER BY created_at DESC LIMIT 50;');
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<QueryResult | null>(null);
	const [showDrawer, setShowDrawer] = useState(false);

	const [safeModalData, setSafeModalData] = useState<{
		isOpen: boolean;
		dangerousCommand?: string;
		reason?: string;
		targetTable?: string;
	}>({ isOpen: false });

	const handleExecute = async (bypassSafeMode = false, explain = false) => {
		const clean = query.trim();
		if (!clean || isLoading) return;

		setIsLoading(true);
		setResult(null);

		try {
			const res = await fetch('/api/database/query', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({
					query: clean,
					bypassSafeMode,
					explain,
				}),
			});

			const data = await res.json();

			if (data.requiresSafeConfirmation) {
				setIsLoading(false);
				setSafeModalData({
					isOpen: true,
					dangerousCommand: data.dangerousCommand,
					reason: data.safeReason,
					targetTable: data.targetTable,
				});
				return;
			}

			if (res.ok) {
				setResult({
					success: true,
					command: data.command,
					rowCount: data.rowCount,
					fields: data.fields,
					rows: data.rows,
					durationMs: data.durationMs,
					isExplain: data.isExplain,
					explainPlan: data.explainPlan,
				});
				appendQueryHistory(clean, data.durationMs);
				onQueryExecuted?.();
			} else {
				setResult({
					success: false,
					error: data.error || t('dbQueryError'),
					durationMs: data.durationMs,
				});
			}
		} catch (err) {
			setResult({
				success: false,
				error: err instanceof Error ? err.message : t('connError'),
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void handleExecute();
		}
	};

	return (
		<div className={s.sqlContainer} style={{ position: 'relative' }}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
					<span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>
						{t('dbSqlQueryPrompt')} (⌘+Enter / Ctrl+Enter)
					</span>

					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<button
							type="button"
							onClick={() => setShowDrawer(!showDrawer)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '5px',
								padding: '5px 10px',
								borderRadius: '6px',
								fontSize: '11.5px',
								background: 'var(--fill-soft)',
								border: '1px solid var(--window-border)',
								color: 'inherit',
								cursor: 'pointer',
							}}
						>
							<Sparkles size={12} color="var(--accent)" />
							<span>{t('dbSqlTemplatesAndHistory')}</span>
						</button>

						<button
							type="button"
							onClick={() => handleExecute(false, true)}
							disabled={isLoading || !query.trim()}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '5px',
								padding: '5px 10px',
								borderRadius: '6px',
								fontSize: '11.5px',
								background: 'var(--fill-soft)',
								border: '1px solid var(--window-border)',
								color: 'inherit',
								cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
								opacity: isLoading || !query.trim() ? 0.6 : 1,
							}}
							title={t('dbExplainPlanTitle')}
						>
							<Activity size={12} color="var(--accent)" />
							<span>{t('dbExplainPlanAction')}</span>
						</button>

						<button
							type="button"
							className={s.saveBtn}
							onClick={() => handleExecute(false, false)}
							disabled={isLoading || !query.trim()}
							style={{ padding: '6px 14px', fontSize: 12 }}
						>
							{isLoading ? (
								<>
									<Loader2 size={13} className="animate-spin" />
									<span>{t('dbRunning')}</span>
								</>
							) : (
								<>
									<Play size={13} fill="currentColor" />
									<span>{t('dbRunQuery')}</span>
								</>
							)}
						</button>
					</div>
				</div>

				<textarea
					className={s.sqlEditor}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="SELECT * FROM ...;"
					spellCheck={false}
				/>
			</div>

			{result && <SqlResultPanel result={result} />}

			{showDrawer && (
				<DatabaseSqlDrawer
					onSelectQuery={(sql) => setQuery(sql)}
					onClose={() => setShowDrawer(false)}
					currentQuery={query}
				/>
			)}

			{safeModalData.isOpen && (
				<DatabaseSafeModeModal
					dangerousCommand={safeModalData.dangerousCommand}
					reason={safeModalData.reason}
					targetTable={safeModalData.targetTable}
					onCancel={() => setSafeModalData({ isOpen: false })}
					onConfirm={() => {
						setSafeModalData({ isOpen: false });
						void handleExecute(true, false);
					}}
				/>
			)}
		</div>
	);
}
