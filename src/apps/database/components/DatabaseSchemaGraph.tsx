'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Plus, RefreshCw, GitFork, Table as TableIcon } from 'lucide-react';
import type { SchemaGraphData } from '../types';

interface DatabaseSchemaGraphProps {
	dbToken: string;
	onSelectTable: (tableName: string) => void;
	onOpenCreateTable: () => void;
}

const NODE_WIDTH = 240;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 38;
const GAP_X = 80;
const COLS_PER_ROW = 4;

export function DatabaseSchemaGraph({ dbToken, onSelectTable, onOpenCreateTable }: DatabaseSchemaGraphProps) {
	const [data, setData] = useState<SchemaGraphData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Pan & Zoom state
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 40, y: 40 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

	const [hoveredTable, setHoveredTable] = useState<string | null>(null);

	const fetchSchema = useCallback(async () => {
		if (!dbToken) return;
		setIsLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/database/schema', {
				headers: { 'x-db-token': dbToken },
			});
			if (!res.ok) throw new Error('Şema yüklenemedi.');
			const json = await res.json();
			setData(json);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Şema okunamadı.');
		} finally {
			setIsLoading(false);
		}
	}, [dbToken]);

	useEffect(() => {
		void fetchSchema();
	}, [fetchSchema]);

	// Calculate 2D position for each table
	const nodePositions = useMemo(() => {
		if (!data) return new Map<string, { x: number; y: number; width: number; height: number }>();
		const map = new Map<string, { x: number; y: number; width: number; height: number }>();

		data.tables.forEach((table, index) => {
			const colIndex = index % COLS_PER_ROW;
			const rowIndex = Math.floor(index / COLS_PER_ROW);

			const height = HEADER_HEIGHT + Math.min(table.columns.length, 12) * ROW_HEIGHT + 14;
			const x = colIndex * (NODE_WIDTH + GAP_X);
			// Calculate cumulative y or approximate row height
			const y = rowIndex * 320;

			map.set(table.name, { x, y, width: NODE_WIDTH, height });
		});

		return map;
	}, [data]);

	// Pan drag handlers
	const handleMouseDown = (e: React.MouseEvent) => {
		if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
		setIsDragging(true);
		setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging) return;
		setPan({
			x: e.clientX - dragStart.x,
			y: e.clientY - dragStart.y,
		});
	};

	const handleMouseUp = () => {
		setIsDragging(false);
	};

	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY < 0 ? 0.08 : -0.08;
		setZoom((prev) => Math.min(2.5, Math.max(0.4, prev + delta)));
	};

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				position: 'relative',
				overflow: 'hidden',
				background: 'var(--window-bg)',
			}}
		>
			{/* Toolbar Header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '10px 18px',
					background: 'var(--fill-softer)',
					borderBottom: '1px solid var(--window-border)',
					zIndex: 10,
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
					<div style={{ fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
						<GitFork size={16} color="var(--accent)" />
						<span>Görsel ER Şeması & DDL</span>
					</div>
					{data && (
						<div style={{ fontSize: '11px', opacity: 0.6 }}>
							{data.tables.length} Tablo • {data.relations.length} İlişki
						</div>
					)}
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{/* Zoom Controls */}
					<div style={{ display: 'flex', alignItems: 'center', background: 'var(--fill-soft)', borderRadius: '6px', border: '1px solid var(--window-border)' }}>
						<button
							type="button"
							onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
							style={{ padding: '5px 8px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
							title="Uzaklaş"
						>
							<ZoomOut size={13} />
						</button>
						<span style={{ fontSize: '11px', padding: '0 4px', minWidth: '40px', textAlign: 'center' }}>
							{Math.round(zoom * 100)}%
						</span>
						<button
							type="button"
							onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
							style={{ padding: '5px 8px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
							title="Yakınlaş"
						>
							<ZoomIn size={13} />
						</button>
						<button
							type="button"
							onClick={() => {
								setZoom(1);
								setPan({ x: 40, y: 40 });
							}}
							style={{ padding: '5px 8px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--window-border)', color: 'inherit', cursor: 'pointer' }}
							title="Sıfırla"
						>
							<RotateCcw size={12} />
						</button>
					</div>

					<button
						type="button"
						onClick={fetchSchema}
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
						<RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
						<span>Yenile</span>
					</button>

					<button
						type="button"
						onClick={onOpenCreateTable}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '5px',
							padding: '5px 12px',
							borderRadius: '6px',
							fontSize: '11.5px',
							fontWeight: 600,
							background: 'var(--accent)',
							color: 'var(--accent-contrast)',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						<Plus size={13} />
						<span>Yeni Tablo Oluştur</span>
					</button>
				</div>
			</div>

			{/* Canvas Area */}
			<div
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onWheel={handleWheel}
				style={{
					flex: 1,
					position: 'relative',
					cursor: isDragging ? 'grabbing' : 'grab',
					userSelect: 'none',
					overflow: 'hidden',
				}}
			>
				{isLoading && !data ? (
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6, gap: '8px' }}>
						<RefreshCw size={20} className="animate-spin" />
						<span>Şema grafiği çıkarılıyor...</span>
					</div>
				) : error ? (
					<div style={{ padding: '30px', color: 'var(--danger)', textAlign: 'center' }}>{error}</div>
				) : data ? (
					<svg
						style={{
							width: '100%',
							height: '100%',
							transformOrigin: '0 0',
						}}
					>
						<g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
							{/* Connection Bezier Lines */}
							{data.relations.map((rel, idx) => {
								const fromPos = nodePositions.get(rel.fromTable);
								const toPos = nodePositions.get(rel.toTable);
								if (!fromPos || !toPos) return null;

								const x1 = fromPos.x + fromPos.width;
								const y1 = fromPos.y + HEADER_HEIGHT + 20;

								const x2 = toPos.x;
								const y2 = toPos.y + HEADER_HEIGHT + 20;

								const dx = Math.abs(x2 - x1) * 0.5;
								const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

								const isHighlighted =
									hoveredTable === rel.fromTable || hoveredTable === rel.toTable;

								return (
									<g key={idx}>
										<path
											d={pathD}
											fill="none"
											stroke={isHighlighted ? 'var(--accent)' : 'var(--text-secondary)'}
											strokeOpacity={isHighlighted ? 1 : 0.45}
											strokeWidth={isHighlighted ? 2.5 : 1.5}
											strokeDasharray={isHighlighted ? undefined : '4 3'}
										/>
										<circle
											cx={x2}
											cy={y2}
											r={3.5}
											fill={isHighlighted ? 'var(--accent)' : 'var(--text-secondary)'}
										/>
									</g>
								);
							})}

							{/* Table Node Cards */}
							{data.tables.map((table, tableIndex) => {
								if (!table || typeof table.name !== 'string') return null;
								const pos = nodePositions.get(table.name);
								if (!pos) return null;

								const isHovered = hoveredTable === table.name;

								return (
									<foreignObject
										key={`${table.name}-${tableIndex}`}
										x={pos.x}
										y={pos.y}
										width={pos.width}
										height={pos.height}
										onMouseEnter={() => setHoveredTable(table.name)}
										onMouseLeave={() => setHoveredTable(null)}
										style={{ overflow: 'visible' }}
									>
										<div
											onClick={() => onSelectTable(table.name)}
											style={{
												width: `${pos.width}px`,
												borderRadius: '8px',
												background: 'var(--modal-surface)',
												border: isHovered
													? '2px solid var(--accent)'
													: '1px solid var(--window-border)',
												boxShadow: isHovered
													? 'var(--accent-glow)'
													: 'var(--shadow-panel)',
												display: 'flex',
												flexDirection: 'column',
												overflow: 'hidden',
												cursor: 'pointer',
												transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
											}}
										>
											{/* Card Header */}
											<div
												style={{
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													padding: '8px 10px',
													background: 'var(--fill-softer)',
													borderBottom: '1px solid var(--window-border)',
												}}
											>
												<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
													<TableIcon size={13} color="var(--accent)" />
													<span style={{ fontSize: '12px', fontWeight: 700 }}>
														{table.name}
													</span>
												</div>
												<span
													style={{
														fontSize: '10px',
														padding: '1px 5px',
														borderRadius: '999px',
														background: 'var(--fill-soft)',
														opacity: 0.8,
													}}
												>
													{table.rowCount}
												</span>
											</div>

											{/* Columns List */}
											<div style={{ display: 'flex', flexDirection: 'column', padding: '6px 8px', gap: '2px' }}>
												{table.columns.slice(0, 10).map((col) => (
													<div
														key={col.name}
														style={{
															display: 'flex',
															alignItems: 'center',
															justifyContent: 'space-between',
															fontSize: '11px',
															padding: '2px 4px',
															borderRadius: '4px',
															height: `${ROW_HEIGHT - 4}px`,
														}}
													>
														<div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
															<span
																style={{
																	whiteSpace: 'nowrap',
																	overflow: 'hidden',
																	textOverflow: 'ellipsis',
																	fontWeight: col.isPk ? 700 : 400,
																}}
															>
																{col.name}
															</span>
															{col.isPk && (
																<span
																	style={{
																		fontSize: '8.5px',
																		fontWeight: 700,
																		color: 'var(--warning)',
																		background: 'color-mix(in srgb, var(--warning) 15%, transparent)',
																		padding: '1px 4px',
																		borderRadius: '3px',
																	}}
																>
																	PK
																</span>
															)}
															{col.isFk && (
																<span
																	style={{
																		fontSize: '8.5px',
																		fontWeight: 700,
																		color: 'var(--info)',
																		background: 'color-mix(in srgb, var(--info) 15%, transparent)',
																		padding: '1px 4px',
																		borderRadius: '3px',
																	}}
																>
																	FK
																</span>
															)}
														</div>
														<span style={{ fontSize: '9.5px', opacity: 0.5 }}>
															{col.type}
														</span>
													</div>
												))}
												{table.columns.length > 10 && (
													<div style={{ fontSize: '10px', opacity: 0.5, textAlign: 'center', paddingTop: '2px' }}>
														+{table.columns.length - 10} sütun daha...
													</div>
												)}
											</div>
										</div>
									</foreignObject>
								);
							})}
						</g>
					</svg>
				) : null}
			</div>
		</div>
	);
}
