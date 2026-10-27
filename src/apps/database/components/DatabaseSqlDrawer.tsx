'use client';

import React, { useState, useEffect } from 'react';
import { X, Bookmark, History, Sparkles, Trash2, Play, Plus, HardDrive } from 'lucide-react';
import s from '../Database.module.css';

interface DatabaseSqlDrawerProps {
	onSelectQuery: (sql: string) => void;
	onClose: () => void;
	currentQuery: string;
}

interface SavedQuery {
	id: string;
	title: string;
	sql: string;
	createdAt: number;
}

interface QueryHistoryItem {
	id: string;
	sql: string;
	timestamp: number;
	durationMs?: number;
}

const SYSTEM_TEMPLATES = [
	{
		title: 'Disk Kullanımı: En Büyük Tablolar & İndeksler',
		desc: 'PostgreSQL tablolarının ve indekslerinin kapladığı gerçek disk alanını listeler.',
		sql: `SELECT
  relname AS tablo_adi,
  pg_size_pretty(pg_total_relation_size(relid)) AS toplam_boyut,
  pg_size_pretty(pg_relation_size(relid)) AS tablo_boyutu,
  pg_size_pretty(pg_indexes_size(relid)) AS indeks_boyutu
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 50;`,
	},
	{
		title: 'Aktif Veritabanı Bağlantıları ve Kilitler',
		desc: 'Şu anda çalışan bağlantıları, durumlarını ve aktif sorguları listeler.',
		sql: `SELECT
  pid,
  usename AS kullanici,
  client_addr AS ip_adresi,
  state AS status,
  NOW() - query_start AS calisma_suresi,
  query AS sorgu
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start DESC;`,
	},
	{
		title: 'Tablo İstatistikleri & Ölü Satırlar (Dead Tuples)',
		desc: 'Canlı satırlar, silinen ama temizlenmemiş (dead) satırlar ve VACUUM geçmişi.',
		sql: `SELECT
  relname AS tablo_adi,
  n_live_tup AS canli_satirlar,
  n_dead_tup AS olu_satirlar,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS olu_oran_yuzde,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;`,
	},
	{
		title: 'İndeks Kullanım Verimliliği',
		desc: 'Tabloların Sequential Scan yerine ne sıklıkla Index Scan kullandığını gösterir.',
		sql: `SELECT
  relname AS tablo_adi,
  seq_scan AS sira_tarama,
  idx_scan AS indeks_tarama,
  ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS indeks_kullanim_yuzdesi
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 50;`,
	},
];

const SAVED_STORAGE_KEY = 'clubpanel_db_saved_queries';
const HISTORY_STORAGE_KEY = 'clubpanel_db_query_history';

export function DatabaseSqlDrawer({ onSelectQuery, onClose, currentQuery }: DatabaseSqlDrawerProps) {
	const [activeSubTab, setActiveSubTab] = useState<'templates' | 'saved' | 'history'>('templates');

	const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
	const [newTitle, setNewTitle] = useState('');
	const [showAddForm, setShowAddForm] = useState(false);

	const [history, setHistory] = useState<QueryHistoryItem[]>([]);

	useEffect(() => {
		try {
			const rawSaved = localStorage.getItem(SAVED_STORAGE_KEY);
			if (rawSaved) setSavedQueries(JSON.parse(rawSaved));

			const rawHist = localStorage.getItem(HISTORY_STORAGE_KEY);
			if (rawHist) setHistory(JSON.parse(rawHist));
		} catch {
			// ignore local storage errors
		}
	}, []);

	const handleSaveCurrent = () => {
		if (!currentQuery.trim() || !newTitle.trim()) return;

		const newItem: SavedQuery = {
			id: 'sq_' + Date.now(),
			title: newTitle.trim(),
			sql: currentQuery.trim(),
			createdAt: Date.now(),
		};

		const updated = [newItem, ...savedQueries];
		setSavedQueries(updated);
		localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(updated));
		setNewTitle('');
		setShowAddForm(false);
	};

	const handleDeleteSaved = (id: string) => {
		const updated = savedQueries.filter((q) => q.id !== id);
		setSavedQueries(updated);
		localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(updated));
	};

	const handleClearHistory = () => {
		setHistory([]);
		localStorage.removeItem(HISTORY_STORAGE_KEY);
	};

	return (
		<>
			<div className={s.drawerBackdrop} onClick={onClose} />
			<div className={s.drawerPanel}>
				{/* Drawer Top */}
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
					<span>SQL Şablonları & Geçmiş</span>
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

			{/* Sub Tabs */}
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
					style={{
						flex: 1,
						padding: '8px 0',
						border: 'none',
						borderBottom: activeSubTab === 'templates' ? '2px solid var(--accent)' : '2px solid transparent',
						background: 'transparent',
						color: activeSubTab === 'templates' ? 'var(--accent)' : 'inherit',
						fontSize: '11.5px',
						fontWeight: activeSubTab === 'templates' ? 700 : 500,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '4px',
					}}
				>
					<HardDrive size={12} />
					<span>Sistem ({SYSTEM_TEMPLATES.length})</span>
				</button>
				<button
					type="button"
					onClick={() => setActiveSubTab('saved')}
					style={{
						flex: 1,
						padding: '8px 0',
						border: 'none',
						borderBottom: activeSubTab === 'saved' ? '2px solid var(--accent)' : '2px solid transparent',
						background: 'transparent',
						color: activeSubTab === 'saved' ? 'var(--accent)' : 'inherit',
						fontSize: '11.5px',
						fontWeight: activeSubTab === 'saved' ? 700 : 500,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '4px',
					}}
				>
					<Bookmark size={12} />
					<span>Kayıtlı ({savedQueries.length})</span>
				</button>
				<button
					type="button"
					onClick={() => setActiveSubTab('history')}
					style={{
						flex: 1,
						padding: '8px 0',
						border: 'none',
						borderBottom: activeSubTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
						background: 'transparent',
						color: activeSubTab === 'history' ? 'var(--accent)' : 'inherit',
						fontSize: '11.5px',
						fontWeight: activeSubTab === 'history' ? 700 : 500,
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '4px',
					}}
				>
					<History size={12} />
					<span>Geçmiş ({history.length})</span>
				</button>
			</div>

			{/* Content Area */}
			<div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
				{/* 1. SYSTEM TEMPLATES */}
				{activeSubTab === 'templates' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
						{SYSTEM_TEMPLATES.map((tmpl) => (
							<div
								key={tmpl.title}
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
								<div style={{ fontSize: '12px', fontWeight: 700 }}>{tmpl.title}</div>
								<div style={{ fontSize: '11px', opacity: 0.65 }}>{tmpl.desc}</div>
								<button
									type="button"
									onClick={() => {
										onSelectQuery(tmpl.sql);
										onClose();
									}}
									style={{
										alignSelf: 'flex-start',
										display: 'inline-flex',
										alignItems: 'center',
										gap: '4px',
										marginTop: '4px',
										padding: '4px 9px',
										borderRadius: '5px',
										fontSize: '11px',
										fontWeight: 600,
										background: 'var(--accent)',
										color: 'var(--accent-contrast)',
										border: 'none',
										cursor: 'pointer',
									}}
								>
									<Play size={10} fill="currentColor" />
									<span>Editöre Yapıştır</span>
								</button>
							</div>
						))}
					</div>
				)}

				{/* 2. SAVED QUERIES */}
				{activeSubTab === 'saved' && (
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
								<span>Mevcut Sorguyu Kaydet</span>
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
									placeholder="Sorgu başlığı..."
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
										Vazgeç
									</button>
									<button
										type="button"
										onClick={handleSaveCurrent}
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
										Kaydet
									</button>
								</div>
							</div>
						)}

						{savedQueries.length === 0 ? (
							<div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', padding: '24px 0' }}>
								Kayıtlı özel sorgunuz bulunmuyor.
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
											onClick={() => handleDeleteSaved(sq.id)}
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
										onClick={() => {
											onSelectQuery(sq.sql);
											onClose();
										}}
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
										<span>Kullan</span>
									</button>
								</div>
							))
						)}
					</div>
				)}

				{/* 3. QUERY HISTORY */}
				{activeSubTab === 'history' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{history.length > 0 && (
							<button
								type="button"
								onClick={handleClearHistory}
								style={{
									alignSelf: 'flex-end',
									background: 'transparent',
									border: 'none',
									color: 'var(--danger)',
									fontSize: '11px',
									cursor: 'pointer',
									marginBottom: '4px',
								}}
							>
								Geçmişi Temizle
							</button>
						)}

						{history.length === 0 ? (
							<div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', padding: '24px 0' }}>
								Henüz çalıştırılmış bir sorgu geçmişi yok.
							</div>
						) : (
							history.map((h) => (
								<div
									key={h.id}
									onClick={() => {
										onSelectQuery(h.sql);
										onClose();
									}}
									style={{
										padding: '8px 10px',
										borderRadius: '6px',
										background: 'var(--fill-softer)',
										border: '1px solid var(--window-border)',
										cursor: 'pointer',
										display: 'flex',
										flexDirection: 'column',
										gap: '4px',
										transition: 'background 0.15s ease',
									}}
								>
									<div
										style={{
											fontFamily: 'monospace',
											fontSize: '11px',
											whiteSpace: 'nowrap',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
										}}
									>
										{h.sql}
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', opacity: 0.5 }}>
										<span>{new Date(h.timestamp).toLocaleTimeString()}</span>
										{h.durationMs !== undefined && <span>{h.durationMs}ms</span>}
									</div>
								</div>
							))
						)}
					</div>
				)}
			</div>
		</div>
		</>
	);
}
