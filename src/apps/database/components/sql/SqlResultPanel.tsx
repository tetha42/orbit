'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { SqlResultTable } from './SqlResultTable';
import type { QueryResult } from '../../types';

interface SqlResultPanelProps {
	result: QueryResult;
}

export function SqlResultPanel({ result }: SqlResultPanelProps) {
	const { t } = useI18n();

	return (
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
								? t('dbExplainPlanSuccess')
								: fill(t('dbQueryCompleted'), {
										command: result.command || 'SELECT',
										count: result.rowCount ?? 0,
									})
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
						{t('dbExplainTreeTitle')}
					</div>
					<pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace' }}>
						{JSON.stringify(result.explainPlan, null, 2)}
					</pre>
				</div>
			) : result.rows && result.fields ? (
				<SqlResultTable
					fields={result.fields}
					rows={result.rows}
					rowCount={result.rowCount}
				/>
			) : null}
		</div>
	);
}
