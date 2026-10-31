'use client';

import React, { useState } from 'react';
import { Play, Loader2, CheckCircle2, AlertTriangle, Clock, Sparkles, Activity, Download } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { downloadCsv, downloadBlob } from '@/core/data/download';
import { DatabaseSqlDrawer } from './DatabaseSqlDrawer';
import { DatabaseSafeModeModal } from './DatabaseSafeModeModal';
import type { QueryResult } from '../types';
import s from '../Database.module.css';

interface DatabaseSqlConsoleProps {
	dbToken: string;
	onQueryExecuted?: () => void;
}

const HISTORY_STORAGE_KEY = 'clubpanel_db_query_history';

export function DatabaseSqlConsole({ dbToken, onQueryExecuted }: DatabaseSqlConsoleProps) {
	const { t } = useI18n();
	const [query, setQuery] = useState('SELECT * FROM users ORDER BY created_at DESC LIMIT 50;');
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<QueryResult | null>(null);

	const [showDrawer, setShowDrawer] = useState(false);

	// Safe Mode state
	const [safeModalData, setSafeModalData] = useState<{
		isOpen: boolean;
		dangerousCommand?: string;
		reason?: string;
		targetTable?: string;
	}>({ isOpen: false });

	const saveToHistory = (sql: string, durationMs?: number) => {
		try {
			const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
			const list = raw ? JSON.parse(raw) : [];
			const newItem = {
				id: 'h_' + Date.now(),
				sql: sql.trim(),
				timestamp: Date.now(),
				durationMs,
			};
			const updated = [newItem, ...list.slice(0, 49)];
			localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
		} catch {
			// ignore storage errors
		}
	};

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

			// Safe Mode Interception
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
				saveToHistory(clean, data.durationMs);
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
							<span>Şablonlar & Geçmiş</span>
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
							title="EXPLAIN ANALYZE ile yürütme planını görselleştir"
						>
							<Activity size={12} color="var(--accent)" />
							<span>Planı Açıkla (EXPLAIN)</span>
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

			{/* Result Feedback & Stats */}
			{result && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
					<div
						style={{
							padding: '8px 12px',
							borderRadius: '8px',
							background: result.success
								? 'color-mix(in srgb, var(--success) 12%, transparent)'
								: 'color-mix(in srgb, var(--danger) 12%, transparent)',
							border: result.success
								? '1px solid color-mix(in srgb, var(--success) 30%, transparent)'
								: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
							color: result.success ? 'var(--success)' : 'var(--danger)',
							fontSize: 12,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 8,
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
							{result.success ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
							<span>
								{result.success
									? result.isExplain
										? 'EXPLAIN ANALYZE Yürütme Planı Başarıyla Çıkarıldı'
										: fill(t('dbQueryCompleted'), { command: result.command || 'SELECT', count: result.rowCount ?? 0 })
									: result.error}
							</span>
						</div>

						{result.durationMs !== undefined && (
							<div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85, fontSize: 11 }}>
								<Clock size={12} />
								<span>{result.durationMs} ms</span>
							</div>
						)}
					</div>

					{/* EXPLAIN JSON or normal table rows */}
					{result.isExplain && result.explainPlan ? (
						<div
							style={{
								flex: 1,
								overflow: 'auto',
								padding: '12px',
								background: 'var(--fill-softer)',
								borderRadius: '8px',
								border: '1px solid var(--window-border)',
							}}
						>
							<div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--accent)' }}>
								PostgreSQL Sorgu Optimizasyon Ağacı:
							</div>
							<pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace' }}>
								{JSON.stringify(result.explainPlan, null, 2)}
							</pre>
						</div>
					) : result.rows && result.fields ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
							{/* Result Header & Export Bar */}
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
								<div style={{ fontSize: '11.5px', opacity: 0.8, fontWeight: 600 }}>
									{result.rows.length > 0 ? (
										<span>
											{result.rows.length.toLocaleString()} satır listeleniyor
											{result.rowCount !== undefined && result.rowCount > result.rows.length && (
												<span style={{ opacity: 0.6, marginLeft: 4 }}>
													(Toplam Etkilenen: {result.rowCount.toLocaleString()})
												</span>
											)}
										</span>
									) : (
										<span>0 satır döndü</span>
									)}
								</div>

								{result.rows.length > 0 && (
									<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
										<button
											type="button"
											onClick={() => {
												const headers = result.fields!.map((f) => f.name);
												const dataRows = result.rows!.map((r) =>
													headers.map((h) => {
														const v = r[h];
														return v === null || v === undefined
															? ''
															: typeof v === 'object'
																? JSON.stringify(v)
																: String(v);
													})
												);
												downloadCsv('sql_sonuc', headers, dataRows);
											}}
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: 4,
												padding: '3px 8px',
												borderRadius: '5px',
												fontSize: '11px',
												background: 'var(--fill-soft)',
												border: '1px solid var(--window-border)',
												color: 'inherit',
												cursor: 'pointer',
											}}
											title="Sonuçları CSV formatında indir"
										>
											<Download size={11} />
											<span>CSV İndir</span>
										</button>

										<button
											type="button"
											onClick={() => {
												const jsonStr = JSON.stringify(result.rows, null, 2);
												downloadBlob(
													new Blob([jsonStr], { type: 'application/json;charset=utf-8' }),
													`sql_sonuc_${new Date().toISOString().slice(0, 10)}.json`
												);
											}}
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: 4,
												padding: '3px 8px',
												borderRadius: '5px',
												fontSize: '11px',
												background: 'var(--fill-soft)',
												border: '1px solid var(--window-border)',
												color: 'inherit',
												cursor: 'pointer',
											}}
											title="Sonuçları JSON formatında indir"
										>
											<Download size={11} />
											<span>JSON İndir</span>
										</button>
									</div>
								)}
							</div>

							{result.rows.length > 0 ? (
								<div className={s.sqlResultTableWrapper}>
									<table className={s.gridTable}>
										<thead>
											<tr>
												<th className={s.gridTh} style={{ width: 44, textAlign: 'center' }}>
													#
												</th>
												{result.fields.map((f) => (
													<th key={f.name} className={s.gridTh}>
														{f.name}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{result.rows.map((row, idx) => (
												<tr key={idx} className={s.gridRow}>
													<td
														className={s.gridTd}
														style={{
															width: 44,
															textAlign: 'center',
															opacity: 0.5,
															fontSize: '10.5px',
															fontFamily: 'ui-monospace, monospace',
														}}
													>
														{idx + 1}
													</td>
													{result.fields!.map((f) => {
														const val = row[f.name];
														return (
															<td key={f.name} className={s.gridTd}>
																{val === null || val === undefined ? (
																	<span style={{ opacity: 0.35, fontStyle: 'italic' }}>null</span>
																) : typeof val === 'object' ? (
																	JSON.stringify(val)
																) : (
																	String(val)
																)}
															</td>
														);
													})}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<div
									style={{
										padding: '32px',
										textAlign: 'center',
										opacity: 0.5,
										fontSize: 13,
										border: '1px dashed var(--window-border)',
										borderRadius: '8px',
									}}
								>
									Sorgu başarıyla çalıştırıldı fakat eşleşen satır bulunamadı (0 satır).
								</div>
							)}
						</div>
					) : null}
				</div>
			)}

			{/* SQL Drawer */}
			{showDrawer && (
				<DatabaseSqlDrawer
					onSelectQuery={(sql) => setQuery(sql)}
					onClose={() => setShowDrawer(false)}
					currentQuery={query}
				/>
			)}

			{/* Safe Mode Modal */}
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
