'use client';

import React from 'react';
import { fill } from '@/lib/text';
import type { SIEM_I18N } from './i18nSiem';
import s from '../../../Soc.module.css';
import siem from '../../../SocSiem.module.css';

interface SiemLogDetailBoxProps {
	detail: Record<string, unknown>;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onSelectData: (e: React.MouseEvent<HTMLElement>) => void;
	onPivotFilter: (key: string, value: string, op: 'eq' | 'neq') => void;
}

export function SiemLogDetailBox({ detail, copy, onSelectData, onPivotFilter }: SiemLogDetailBoxProps) {
	return (
		<div style={{ marginTop: 6 }}>
			<pre className={siem.detailBox}>{JSON.stringify(detail, null, 2)}</pre>
			{typeof detail === 'object' && detail !== null && (
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
					{Object.entries(detail).map(([k, v]) => {
						const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
						if (!valStr || valStr.length > 50) return null;
						return (
							<span key={k} className={siem.siemPivotWrap}>
								<span
									data-type="detail"
									className={s.selectableData}
									onDoubleClick={onSelectData}
									style={{ fontSize: 10.5, opacity: 0.75 }}
									title={copy.hintDetail}
								>
									{k}: {valStr}
								</span>
								<button
									type="button"
									className={siem.siemPivotBtn}
									onClick={() => onPivotFilter(k, valStr, 'eq')}
									title={fill(copy.pivotAddTitle, { k, val: valStr })}
								>
									{copy.pivotAddBtn}
								</button>
								<button
									type="button"
									className={siem.siemPivotBtn}
									onClick={() => onPivotFilter(k, valStr, 'neq')}
									title={fill(copy.pivotExclTitle, { k, val: valStr })}
								>
									{copy.pivotExclBtn}
								</button>
							</span>
						);
					})}
				</div>
			)}
		</div>
	);
}
