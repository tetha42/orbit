'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { computeSchemaNodePositions, SCHEMA_HEADER_HEIGHT } from './schema/schemaLayout';
import { SchemaGraphToolbar } from './schema/SchemaGraphToolbar';
import { SchemaTableCard } from './schema/SchemaTableCard';
import type { SchemaGraphData } from '../types';

interface DatabaseSchemaGraphProps {
	dbToken: string;
	onSelectTable: (tableName: string) => void;
	onOpenCreateTable: () => void;
}

export function DatabaseSchemaGraph({
	dbToken,
	onSelectTable,
	onOpenCreateTable,
}: DatabaseSchemaGraphProps) {
	const { t } = useI18n();
	const tRef = useRef(t);
	useEffect(() => {
		tRef.current = t;
	}, [t]);
	const [data, setData] = useState<SchemaGraphData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
			if (!res.ok) throw new Error(tRef.current('dbSchemaLoadFailed'));
			const json = await res.json();
			setData(json);
		} catch (err) {
			setError(err instanceof Error ? err.message : tRef.current('dbSchemaReadFailed'));
		} finally {
			setIsLoading(false);
		}
	}, [dbToken]);

	useEffect(() => {
		void fetchSchema();
	}, [fetchSchema]);

	const nodePositions = useMemo(() => computeSchemaNodePositions(data), [data]);

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

	const canvasRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = canvasRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const delta = e.deltaY < 0 ? 0.08 : -0.08;
			setZoom((prev) => Math.min(2.5, Math.max(0.4, prev + delta)));
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, []);

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
			<SchemaGraphToolbar
				data={data}
				zoom={zoom}
				isLoading={isLoading}
				onZoomOut={() => setZoom((z) => Math.max(0.4, z - 0.15))}
				onZoomIn={() => setZoom((z) => Math.min(2.5, z + 0.15))}
				onResetView={() => {
					setZoom(1);
					setPan({ x: 40, y: 40 });
				}}
				onRefresh={fetchSchema}
				onOpenCreateTable={onOpenCreateTable}
			/>

			{/* Canvas area */}
			<div
				ref={canvasRef}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
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
						<span>{t('dbSchemaBuilding')}</span>
					</div>
				) : error ? (
					<div style={{ padding: '30px', color: 'var(--danger)', textAlign: 'center' }}>{error}</div>
				) : data ? (
					<svg style={{ width: '100%', height: '100%', transformOrigin: '0 0' }}>
						<g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
							{/* Connection bezier lines */}
							{data.relations.map((rel, idx) => {
								const fromPos = nodePositions.get(rel.fromTable);
								const toPos = nodePositions.get(rel.toTable);
								if (!fromPos || !toPos) return null;

								const x1 = fromPos.x + fromPos.width;
								const y1 = fromPos.y + SCHEMA_HEADER_HEIGHT + 20;
								const x2 = toPos.x;
								const y2 = toPos.y + SCHEMA_HEADER_HEIGHT + 20;
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

							{/* Table node cards */}
							{data.tables.map((table, tableIndex) => {
								if (!table || typeof table.name !== 'string') return null;
								const pos = nodePositions.get(table.name);
								if (!pos) return null;

								return (
									<SchemaTableCard
										key={`${table.name}-${tableIndex}`}
										table={table}
										position={pos}
										isHovered={hoveredTable === table.name}
										onHoverStart={() => setHoveredTable(table.name)}
										onHoverEnd={() => setHoveredTable(null)}
										onSelect={() => onSelectTable(table.name)}
									/>
								);
							})}
						</g>
					</svg>
				) : null}
			</div>
		</div>
	);
}
