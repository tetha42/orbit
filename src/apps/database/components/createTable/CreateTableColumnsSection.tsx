'use client';

import React from 'react';
import { Plus, Code2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { CreateTableColumnRow } from './CreateTableColumnRow';
import type { CreateTableColumnInput } from '../../types';

interface CreateTableColumnsSectionProps {
	columns: CreateTableColumnInput[];
	showSqlPreview: boolean;
	generatedSql: string;
	onAddColumn: () => void;
	onUpdateColumn: (index: number, patch: Partial<CreateTableColumnInput>) => void;
	onRemoveColumn: (index: number) => void;
	onToggleSqlPreview: () => void;
}

export function CreateTableColumnsSection({
	columns,
	showSqlPreview,
	generatedSql,
	onAddColumn,
	onUpdateColumn,
	onRemoveColumn,
	onToggleSqlPreview,
}: CreateTableColumnsSectionProps) {
	const { t } = useI18n();
	return (
		<>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<label style={{ fontSize: '12px', fontWeight: 600 }}>{fill(t('dbCreateTableColumnsLabel'), { n: columns.length })}</label>
					<button
						type="button"
						onClick={onAddColumn}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							padding: '4px 8px',
							borderRadius: '5px',
							fontSize: '11px',
							background: 'var(--accent-subtle)',
							color: 'var(--accent)',
							border: '1px solid var(--accent-border)',
							cursor: 'pointer',
						}}
					>
						<Plus size={12} />
						<span>{t('dbAddColumn')}</span>
					</button>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
					{columns.map((c, idx) => (
						<CreateTableColumnRow
							key={idx}
							column={c}
							index={idx}
							canRemove={columns.length > 1}
							onUpdate={onUpdateColumn}
							onRemove={onRemoveColumn}
						/>
					))}
				</div>
			</div>

			{/* Live SQL preview toggle */}
			<div>
				<button
					type="button"
					onClick={onToggleSqlPreview}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '5px',
						background: 'transparent',
						border: 'none',
						color: 'var(--accent)',
						fontSize: '11.5px',
						cursor: 'pointer',
						padding: 0,
					}}
				>
					<Code2 size={13} />
					<span>{showSqlPreview ? t('dbHideSqlPreview') : t('dbShowGeneratedSql')}</span>
				</button>

				{showSqlPreview && (
					<pre
						style={{
							marginTop: '8px',
							padding: '10px 12px',
							borderRadius: '8px',
							background: 'var(--fill-softer)',
							border: '1px solid var(--window-border)',
							fontFamily: 'monospace',
							fontSize: '11px',
							overflowX: 'auto',
						}}
					>
						{generatedSql}
					</pre>
				)}
			</div>
		</>
	);
}
