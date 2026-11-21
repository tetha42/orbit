'use client';

import React from 'react';
import { GitCompare, CheckCircle2 } from 'lucide-react';
import type { FimAnomaly, InspectorEntity } from '../../../types';
import type { INSPECTION_I18N } from './i18nInspection';
import s from '../../../Soc.module.css';
import ins from '../../../SocInspection.module.css';

interface FimAnomaliesTableProps {
	anomalies: FimAnomaly[];
	copy: (typeof INSPECTION_I18N)['en'] | (typeof INSPECTION_I18N)['tr'];
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onSelectData: (e: React.MouseEvent<HTMLElement>) => void;
	onOpenInspector: (entity: InspectorEntity) => void;
	onOpenDiffModal: (filePath: string) => void;
}

export function FimAnomaliesTable({
	anomalies,
	copy,
	onContainerDoubleClick,
	onSelectData,
	onOpenInspector,
	onOpenDiffModal,
}: FimAnomaliesTableProps) {
	if (anomalies.length === 0) {
		return (
			<div className={s.cleanState}>
				<CheckCircle2 size={20} />
				<div>
					<strong>{copy.baselineVerifiedTitle}</strong>
					<div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{copy.baselineVerifiedDesc}</div>
				</div>
			</div>
		);
	}

	return (
		<div style={{ marginTop: 16 }}>
			<h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>{copy.deviationsTitle}</h4>
			<div className={s.tableContainer} onDoubleClick={onContainerDoubleClick}>
				<table className={s.table}>
					<thead>
						<tr>
							<th>{copy.colActionType}</th>
							<th>{copy.colFilePath}</th>
							<th>{copy.colBaselineHash}</th>
							<th>{copy.colCurrentHash}</th>
							<th>{copy.colActions}</th>
						</tr>
					</thead>
					<tbody>
						{anomalies.map((an, idx) => (
							<tr
								key={`${an.path}-${idx}`}
								onClick={() =>
									onOpenInspector({
										type: 'fim',
										data: { file: an.path, sha256: an.newHash || an.oldHash, anomaly: an },
									})
								}
								style={{ cursor: 'pointer' }}
								title={copy.openInInspector}
							>
								<td>
									<span
										className={
											an.type === 'modified' ? ins.badgeWarn : an.type === 'added' ? s.badgeFail : s.statTag
										}
									>
										{an.type.toUpperCase()}
									</span>
								</td>
								<td className={s.mono} style={{ fontSize: 12 }}>
									<span
										data-type="path"
										className={s.selectableData}
										onDoubleClick={onSelectData}
										title={copy.hintSelectPath}
									>
										{an.path}
									</span>
								</td>
								<td className={s.mono} style={{ fontSize: 11, opacity: 0.7 }}>
									<span
										data-type="hash"
										className={s.selectableData}
										onDoubleClick={onSelectData}
										title={an.oldHash || undefined}
									>
										{an.oldHash ? `${an.oldHash.slice(0, 16)}…` : '—'}
									</span>
								</td>
								<td className={s.mono} style={{ fontSize: 11, opacity: 0.7 }}>
									<span
										data-type="hash"
										className={s.selectableData}
										onDoubleClick={onSelectData}
										title={an.newHash || undefined}
									>
										{an.newHash ? `${an.newHash.slice(0, 16)}…` : '—'}
									</span>
								</td>
								<td>
									<button
										type="button"
										className={s.actionBtn}
										style={{ height: 24, padding: '0 8px', fontSize: 11 }}
										onClick={(e) => {
											e.stopPropagation();
											onOpenDiffModal(an.path);
										}}
									>
										<GitCompare size={12} />
										<span>{copy.diffBtn}</span>
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
