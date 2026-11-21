'use client';

import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { fill } from '@/lib/text';
import type { FimScanResult, InspectorEntity } from '../../../types';
import type { INSPECTION_I18N } from './i18nInspection';
import { FimAnomaliesTable } from './FimAnomaliesTable';
import s from '../../../Soc.module.css';
import ins from '../../../SocInspection.module.css';

interface FimScannerPanelProps {
	fimResult: FimScanResult | null;
	fimTarget: string;
	inspectionLoading: boolean;
	canManage: boolean;
	copy: (typeof INSPECTION_I18N)['en'] | (typeof INSPECTION_I18N)['tr'];
	onTargetChange: (val: string) => void;
	onTriggerFimScan: () => Promise<void> | void;
	onCreateBaseline: () => Promise<void> | void;
	onOpenInspector: (entity: InspectorEntity) => void;
	onContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	onSelectData: (e: React.MouseEvent<HTMLElement>) => void;
	onOpenDiffModal: (filePath: string) => void;
}

export function FimScannerPanel({
	fimResult,
	fimTarget,
	inspectionLoading,
	canManage,
	copy,
	onTargetChange,
	onTriggerFimScan,
	onCreateBaseline,
	onOpenInspector,
	onContainerDoubleClick,
	onSelectData,
	onOpenDiffModal,
}: FimScannerPanelProps) {
	return (
		<>
			<div className={ins.inspectionBanner}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
					<label style={{ fontSize: 12.5, fontWeight: 600 }}>{copy.targetDir}</label>
					<select
						className={s.select}
						value={fimTarget}
						onChange={(e) => onTargetChange(e.target.value)}
						disabled={inspectionLoading}
					>
						<option value="repo">{copy.dirRepo}</option>
						<option value="uploads">{copy.dirUploads}</option>
						<option value="tmp">{copy.dirTmp}</option>
					</select>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
					<button
						type="button"
						className={s.actionBtn}
						onClick={() => void onTriggerFimScan()}
						disabled={inspectionLoading}
					>
						<RefreshCw size={14} className={inspectionLoading ? s.spin : ''} />
						<span>{inspectionLoading ? copy.scanningFs : copy.scanFilesBtn}</span>
					</button>

					{canManage && (
						<button
							type="button"
							className={s.actionBtn}
							onClick={() => void onCreateBaseline()}
							disabled={inspectionLoading}
							title={copy.saveBaselineTitle}
						>
							<CheckCircle2 size={14} />
							<span>{copy.saveBaselineBtn}</span>
						</button>
					)}
				</div>
			</div>

			<div className={ins.fimGrid}>
				<div className={ins.fimMetricCard}>
					<span className={ins.fimMetricLabel}>{copy.metricScanned}</span>
					<span className={ins.fimMetricVal}>{fimResult?.scannedFiles ?? 0}</span>
				</div>
				<div className={ins.fimMetricCard}>
					<span className={ins.fimMetricLabel}>{copy.metricDuration}</span>
					<span className={ins.fimMetricVal}>{fimResult?.durationMs ?? 0} ms</span>
				</div>
				<div className={ins.fimMetricCard}>
					<span className={ins.fimMetricLabel}>{copy.metricSuspicious}</span>
					<span
						className={ins.fimMetricVal}
						style={{ color: (fimResult?.suspiciousFiles?.length ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}
					>
						{fimResult?.suspiciousFiles?.length ?? 0}
					</span>
				</div>
				<div className={ins.fimMetricCard}>
					<span className={ins.fimMetricLabel}>{copy.metricDeviations}</span>
					<span
						className={ins.fimMetricVal}
						style={{ color: (fimResult?.anomalies?.length ?? 0) > 0 ? 'var(--warning)' : 'var(--text-primary)' }}
					>
						{fimResult?.anomalies?.length ?? 0}
					</span>
				</div>
			</div>

			{fimResult?.suspiciousFiles && fimResult.suspiciousFiles.length > 0 ? (
				<div className={ins.suspiciousBox}>
					<div className={ins.suspiciousBoxTitle}>
						<AlertTriangle size={18} />
						<span>{fill(copy.suspiciousAlert, { count: fimResult.suspiciousFiles.length })}</span>
					</div>
					{fimResult.suspiciousFiles.map((sf, idx) => (
						<div
							key={`${sf.path}-${sf.line}-${idx}`}
							className={ins.suspiciousItem}
							onClick={() => onOpenInspector({ type: 'fim', data: { file: sf.path, match: sf } })}
							style={{ cursor: 'pointer' }}
							title={copy.openInInspector}
						>
							<div className={ins.suspiciousItemHeader}>
								<span className={ins.suspiciousItemPath}>
									{sf.path}:{sf.line}
								</span>
								<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
									<span className={s.badgeFail}>{sf.matchedRule}</span>
									<span className={s.badgeFail}>{sf.severity}</span>
								</div>
							</div>
							<pre className={ins.codeSnippet}>{sf.snippet}</pre>
						</div>
					))}
				</div>
			) : (
				<div className={s.cleanState}>
					<ShieldCheck size={20} />
					<div>
						<strong>{copy.heuristicCleanTitle}</strong>
						<div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{copy.heuristicCleanDesc}</div>
					</div>
				</div>
			)}

			<FimAnomaliesTable
				anomalies={fimResult?.anomalies ?? []}
				copy={copy}
				onContainerDoubleClick={onContainerDoubleClick}
				onSelectData={onSelectData}
				onOpenInspector={onOpenInspector}
				onOpenDiffModal={onOpenDiffModal}
			/>
		</>
	);
}
