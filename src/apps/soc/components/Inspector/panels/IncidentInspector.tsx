'use client';

import React from 'react';
import { Check, Flame, Download } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Language } from '@/lib/i18n';
import { formatDateTime } from '../../../types';
import type { SocIncident, SocIncidentStatus, SoarPlaybookId } from '../../../types';
import type { INSPECTOR_I18N } from '../i18nInspector';
import s from '../SocInspector.module.css';

const INCIDENT_STATUS_KEYS: Record<SocIncidentStatus, string> = {
	new: 'socIncStatusNew',
	triaged: 'socIncStatusTriaged',
	investigating: 'socIncStatusInvestigating',
	contained: 'socIncStatusContained',
	resolved: 'socIncStatusResolved',
	false_positive: 'socIncStatusFalsePositive',
};

interface IncidentInspectorProps {
	inc: SocIncident;
	notes: string;
	setNotes: (val: string) => void;
	isSavingNotes: boolean;
	onSaveNotes: () => Promise<void>;
	canManage: boolean;
	isSubmitting: boolean;
	language: Language;
	copy: (typeof INSPECTOR_I18N)['en'] | (typeof INSPECTOR_I18N)['tr'];
	onUpdateStatus: (id: string, status: SocIncidentStatus, notes?: string) => Promise<unknown> | void;
	onExecutePlaybook: (id: SoarPlaybookId, params: { ip?: string }) => Promise<unknown> | void;
	onExportDossier: (id: string) => Promise<void> | void;
}

export function IncidentInspector({
	inc,
	notes,
	setNotes,
	isSavingNotes,
	onSaveNotes,
	canManage,
	isSubmitting,
	language,
	copy,
	onUpdateStatus,
	onExecutePlaybook,
	onExportDossier,
}: IncidentInspectorProps) {
	const { t } = useI18n();
	const statusLabel = (st: SocIncidentStatus) => t(INCIDENT_STATUS_KEYS[st] ?? 'socIncStatusNew');
	return (
		<>
			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.incidentLifecycle}</span>
					<span
						className={`${s.badge} ${
							inc.severity === 'CRITICAL' || inc.severity === 'HIGH' ? s.badgeDanger : s.badgeWarn
						}`}
					>
						{inc.severity}
					</span>
				</div>

				<div className={s.gridProps}>
					<span className={s.propLabel}>{copy.incidentId}</span>
					<span className={`${s.propValue} ${s.mono}`}>{inc.id}</span>

					<span className={s.propLabel}>{copy.status}</span>
					<span className={s.propValue}>
						{canManage ? (
							<select
								value={inc.status}
								onChange={(e) =>
									void onUpdateStatus(
										inc.id,
										e.target.value as SocIncidentStatus,
										inc.analystNotes || undefined
									)
								}
								disabled={isSubmitting}
								style={{
									padding: '3px 8px',
									borderRadius: 4,
									fontSize: 11,
									background: 'var(--fill-softer)',
									border: '1px solid var(--border-subtle)',
									color: 'var(--text-primary)',
								}}
							>
								<option value="new">{t('socIncStatusNew')}</option>
								<option value="triaged">{t('socIncStatusTriaged')}</option>
								<option value="investigating">{t('socIncStatusInvestigating')}</option>
								<option value="contained">{t('socIncStatusContained')}</option>
								<option value="resolved">{t('socIncStatusResolved')}</option>
								<option value="false_positive">{t('socIncStatusFalsePositive')}</option>
							</select>
						) : (
							<span className={`${s.badge} ${s.badgeNeutral}`}>{statusLabel(inc.status)}</span>
						)}
					</span>

					{inc.sourceIp && (
						<>
							<span className={s.propLabel}>{copy.sourceIp}</span>
							<span className={`${s.propValue} ${s.mono}`} data-type="ip" data-value={inc.sourceIp}>
								{inc.sourceIp}
							</span>
						</>
					)}

					{inc.service && (
						<>
							<span className={s.propLabel}>{copy.targetService}</span>
							<span className={`${s.propValue} ${s.mono}`}>{inc.service}</span>
						</>
					)}

					<span className={s.propLabel}>{copy.createdAt}</span>
					<span className={s.propValue}>{formatDateTime(inc.createdAt, language)}</span>
				</div>
			</div>

			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.analystNotes}</span>
				</div>
				<textarea
					className={s.notesTextarea}
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					placeholder={copy.notesPlaceholder}
					disabled={!canManage || isSavingNotes}
				/>
				{canManage && (
					<button
						type="button"
						className={`${s.containmentBtn} ${s.containmentBtnPrimary}`}
						onClick={() => void onSaveNotes()}
						disabled={isSavingNotes || isSubmitting}
						style={{ marginTop: 6 }}
					>
						<Check size={13} />
						<span>{isSavingNotes ? copy.saving : copy.saveNotes}</span>
					</button>
				)}
			</div>

			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.soarActions}</span>
				</div>
				<div className={s.actionGroup}>
					{canManage && inc.sourceIp && (
						<button
							type="button"
							className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
							onClick={() =>
								void onExecutePlaybook('brute-force-containment', { ip: inc.sourceIp || undefined })
							}
							disabled={isSubmitting}
						>
							<Flame size={13} />
							<span>{copy.runBruteForcePlaybook}</span>
						</button>
					)}
					<button
						type="button"
						className={s.containmentBtn}
						onClick={() => void onExportDossier(inc.id)}
						disabled={isSubmitting}
					>
						<Download size={13} />
						<span>{copy.exportDossier}</span>
					</button>
				</div>
			</div>
		</>
	);
}
