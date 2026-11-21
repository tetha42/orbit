'use client';

import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Plus, RefreshCw, GitFork } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { SchemaGraphData } from '../../types';

interface SchemaGraphToolbarProps {
	data: SchemaGraphData | null;
	zoom: number;
	isLoading: boolean;
	onZoomOut: () => void;
	onZoomIn: () => void;
	onResetView: () => void;
	onRefresh: () => void;
	onOpenCreateTable: () => void;
}

export function SchemaGraphToolbar({
	data,
	zoom,
	isLoading,
	onZoomOut,
	onZoomIn,
	onResetView,
	onRefresh,
	onOpenCreateTable,
}: SchemaGraphToolbarProps) {
	const { t } = useI18n();

	return (
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
					<span>{t('dbSchemaGraphTitle')}</span>
				</div>
				{data && (
					<div style={{ fontSize: '11px', opacity: 0.6 }}>
						{fill(t('dbSchemaGraphStats'), { tables: data.tables.length, relations: data.relations.length })}
					</div>
				)}
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
				{/* Zoom controls */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						background: 'var(--fill-soft)',
						borderRadius: '6px',
						border: '1px solid var(--window-border)',
					}}
				>
					<button
						type="button"
						onClick={onZoomOut}
						style={{ padding: '5px 8px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
						title={t('mediaViewerZoomOut')}
					>
						<ZoomOut size={13} />
					</button>
					<span style={{ fontSize: '11px', padding: '0 4px', minWidth: '40px', textAlign: 'center' }}>
						{Math.round(zoom * 100)}%
					</span>
					<button
						type="button"
						onClick={onZoomIn}
						style={{ padding: '5px 8px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
						title={t('mediaViewerZoomIn')}
					>
						<ZoomIn size={13} />
					</button>
					<button
						type="button"
						onClick={onResetView}
						style={{
							padding: '5px 8px',
							background: 'transparent',
							border: 'none',
							borderLeft: '1px solid var(--window-border)',
							color: 'inherit',
							cursor: 'pointer',
						}}
						title={t('dlgReset')}
					>
						<RotateCcw size={12} />
					</button>
				</div>

				<button
					type="button"
					onClick={onRefresh}
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
					<span>{t('refresh')}</span>
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
					<span>{t('dbCreateTable')}</span>
				</button>
			</div>
		</div>
	);
}
