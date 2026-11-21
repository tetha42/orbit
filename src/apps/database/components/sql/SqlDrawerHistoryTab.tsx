'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { QueryHistoryItem } from '../../utils/sqlStorage';

interface SqlDrawerHistoryTabProps {
	history: QueryHistoryItem[];
	onSelectQuery: (sql: string) => void;
	onClearHistory: () => void;
}

export function SqlDrawerHistoryTab({
	history,
	onSelectQuery,
	onClearHistory,
}: SqlDrawerHistoryTabProps) {
	const { t } = useI18n();
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
			{history.length > 0 && (
				<button
					type="button"
					onClick={onClearHistory}
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
					{t('dbSqlHistoryClear')}
				</button>
			)}

			{history.length === 0 ? (
				<div style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', padding: '24px 0' }}>
					{t('dbSqlHistoryEmpty')}
				</div>
			) : (
				history.map((item) => (
					<div
						key={item.id}
						onClick={() => onSelectQuery(item.sql)}
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
							{item.sql}
						</div>
						<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', opacity: 0.5 }}>
							<span>{new Date(item.timestamp).toLocaleTimeString()}</span>
							{item.durationMs !== undefined && <span>{item.durationMs}ms</span>}
						</div>
					</div>
				))
			)}
		</div>
	);
}
