'use client';

import React from 'react';
import { Table as TableIcon } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { SCHEMA_ROW_HEIGHT, type SchemaNodePosition } from './schemaLayout';
import type { SchemaTableNode } from '../../types';

interface SchemaTableCardProps {
	table: SchemaTableNode;
	position: SchemaNodePosition;
	isHovered: boolean;
	onHoverStart: () => void;
	onHoverEnd: () => void;
	onSelect: () => void;
}

export function SchemaTableCard({
	table,
	position,
	isHovered,
	onHoverStart,
	onHoverEnd,
	onSelect,
}: SchemaTableCardProps) {
	const { t } = useI18n();

	return (
		<foreignObject
			x={position.x}
			y={position.y}
			width={position.width}
			height={position.height}
			onMouseEnter={onHoverStart}
			onMouseLeave={onHoverEnd}
			style={{ overflow: 'visible' }}
		>
			<div
				onClick={onSelect}
				style={{
					width: `${position.width}px`,
					borderRadius: '8px',
					background: 'var(--modal-surface)',
					border: isHovered ? '2px solid var(--accent)' : '1px solid var(--window-border)',
					boxShadow: isHovered ? 'var(--accent-glow)' : 'var(--shadow-panel)',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					cursor: 'pointer',
					transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
				}}
			>
				{/* Card header */}
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
						<span style={{ fontSize: '12px', fontWeight: 700 }}>{table.name}</span>
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

				{/* Columns list */}
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
								height: `${SCHEMA_ROW_HEIGHT - 4}px`,
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
							<span style={{ fontSize: '9.5px', opacity: 0.5 }}>{col.type}</span>
						</div>
					))}
					{table.columns.length > 10 && (
						<div style={{ fontSize: '10px', opacity: 0.5, textAlign: 'center', paddingTop: '2px' }}>
							{fill(t('dbMoreColumns'), { n: table.columns.length - 10 })}
						</div>
					)}
				</div>
			</div>
		</foreignObject>
	);
}
