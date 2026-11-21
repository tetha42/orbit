'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';

export type ImportConflictStrategy = 'error' | 'upsert' | 'skip';

interface ImportStepConflictStrategyProps {
	conflictStrategy: ImportConflictStrategy;
	rowCount: number;
	tableName: string;
	onChangeStrategy: (strategy: ImportConflictStrategy) => void;
}

const STRATEGIES: Array<{
	value: ImportConflictStrategy;
	titleKey: string;
	descriptionKey: string;
}> = [
	{
		value: 'upsert',
		titleKey: 'dbImportUpsertTitle',
		descriptionKey: 'dbImportUpsertDesc',
	},
	{
		value: 'skip',
		titleKey: 'dbImportSkipTitle',
		descriptionKey: 'dbImportSkipDesc',
	},
	{
		value: 'error',
		titleKey: 'dbImportErrorTitle',
		descriptionKey: 'dbImportErrorDesc',
	},
];

export function ImportStepConflictStrategy({
	conflictStrategy,
	rowCount,
	tableName,
	onChangeStrategy,
}: ImportStepConflictStrategyProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ fontSize: '13px', fontWeight: 600 }}>
				{t('dbImportConflictHeading')}
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
				{STRATEGIES.map((strategy) => {
					const selected = conflictStrategy === strategy.value;
					return (
						<label
							key={strategy.value}
							style={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: '10px',
								padding: '12px',
								borderRadius: '8px',
								border: selected ? '1px solid var(--accent)' : '1px solid var(--window-border)',
								background: selected ? 'var(--accent-subtle)' : 'transparent',
								cursor: 'pointer',
							}}
						>
							<input
								type="radio"
								name="conflict"
								checked={selected}
								onChange={() => onChangeStrategy(strategy.value)}
								style={{ marginTop: '2px' }}
							/>
							<div>
								<div style={{ fontSize: '13px', fontWeight: 600 }}>{t(strategy.titleKey)}</div>
								<div style={{ fontSize: '11.5px', opacity: 0.65 }}>{t(strategy.descriptionKey)}</div>
							</div>
						</label>
					);
				})}
			</div>

			<div style={{ padding: '12px', borderRadius: '8px', background: 'var(--fill-softer)', fontSize: '12px' }}>
				<strong>{t('dbImportSummaryLabel')}</strong>{' '}
				{fill(t('dbImportSummary'), { n: rowCount, table: tableName })}
			</div>
		</div>
	);
}
