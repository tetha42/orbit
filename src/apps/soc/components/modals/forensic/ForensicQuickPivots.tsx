'use client';

import React from 'react';
import { fill } from '@/lib/text';
import type { MODALS_I18N } from '../i18nModals';
import s from '../SocModals.module.css';

interface ForensicQuickPivotsProps {
	detail: Record<string, unknown>;
	copy: (typeof MODALS_I18N)['en'] | (typeof MODALS_I18N)['tr'];
	onPivot: (key: string, value: string, op: 'eq' | 'neq') => void;
}

export function ForensicQuickPivots({ detail, copy, onPivot }: ForensicQuickPivotsProps) {
	const entries = Object.entries(detail);
	if (entries.length === 0) return null;

	return (
		<div className={s.formField}>
			<label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
				{copy.forensicQuickPivots}
			</label>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
				{entries.map(([k, v]) => {
					const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
					if (!valStr || valStr.length > 50) return null;
					return (
						<span
							key={k}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 4,
								padding: '3px 7px',
								borderRadius: 5,
								background: 'var(--fill-soft, rgba(0, 0, 0, 0.04))',
								border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
								fontSize: 11,
							}}
						>
							<span>
								{k}: <strong>{valStr}</strong>
							</span>
							<button
								type="button"
								onClick={() => onPivot(k, valStr, 'eq')}
								style={{
									border: 'none',
									background: 'transparent',
									color: 'var(--accent)',
									cursor: 'pointer',
									fontSize: 10,
									fontWeight: 600,
									padding: '0 2px',
								}}
								title={fill(copy.forensicPivotFilterTitle, { k, val: valStr })}
							>
								{copy.forensicFilterAdd}
							</button>
							<button
								type="button"
								onClick={() => onPivot(k, valStr, 'neq')}
								style={{
									border: 'none',
									background: 'transparent',
									color: 'var(--danger)',
									cursor: 'pointer',
									fontSize: 10,
									fontWeight: 600,
									padding: '0 2px',
								}}
								title={fill(copy.forensicPivotExcludeTitle, { k, val: valStr })}
							>
								{copy.forensicExcludeBtn}
							</button>
						</span>
					);
				})}
			</div>
		</div>
	);
}
