'use client';

import React from 'react';
import { Copy, Check, Ban, Globe } from 'lucide-react';
import { fill } from '@/lib/text';
import type { Language } from '@/lib/i18n';
import { formatDateTime } from '../../../types';
import type { SystemLog } from '../../../types';
import { formatSocAlertMessage } from '../../../utils/i18nAlertLocalization';
import type { INSPECTOR_I18N } from '../i18nInspector';
import s from '../SocInspector.module.css';

interface EventInspectorProps {
	ev: SystemLog;
	language: Language;
	canManage: boolean;
	isSubmitting: boolean;
	copied: boolean;
	copy: (typeof INSPECTOR_I18N)['en'] | (typeof INSPECTOR_I18N)['tr'];
	onCopyJson: (val: unknown) => void;
	onQuickBan: (ip: string, reason: string) => Promise<void> | void;
	onFilterSiemIp: (ip: string) => void;
}

export function EventInspector({
	ev,
	language,
	canManage,
	isSubmitting,
	copied,
	copy,
	onCopyJson,
	onQuickBan,
	onFilterSiemIp,
}: EventInspectorProps) {
	const levelClass =
		ev.level === 'CRITICAL' || ev.level === 'ERROR'
			? s.badgeDanger
			: ev.level === 'WARN'
			? s.badgeWarn
			: s.badgeNeutral;

	return (
		<>
			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.eventMetadata}</span>
					<span className={`${s.badge} ${levelClass}`}>{ev.level}</span>
				</div>

				<div className={s.gridProps}>
					<span className={s.propLabel}>{copy.logId}</span>
					<span className={`${s.propValue} ${s.mono}`}>#{ev.id}</span>

					<span className={s.propLabel}>{copy.timestamp}</span>
					<span className={s.propValue}>{formatDateTime(ev.time, language)}</span>

					<span className={s.propLabel}>{copy.service}</span>
					<span className={`${s.propValue} ${s.mono}`}>{ev.service}</span>

					<span className={s.propLabel}>{copy.sourceIp}</span>
					<span className={`${s.propValue} ${s.mono}`} data-type="ip" data-value={ev.ip}>
						{ev.ip || '—'}
					</span>

					{ev.userId && (
						<>
							<span className={s.propLabel}>{copy.userId}</span>
							<span className={`${s.propValue} ${s.mono}`} data-type="user" data-value={ev.userId}>
								{ev.userId}
							</span>
						</>
					)}
				</div>
			</div>

			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.logMessage}</span>
				</div>
				<div className={s.propValue} style={{ fontSize: 12, lineHeight: 1.4 }}>
					{formatSocAlertMessage(ev.message, language)}
				</div>
			</div>

			{ev.detail && (
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{copy.payloadDetails}</span>
						<button
							type="button"
							className={s.iconBtn}
							onClick={() => onCopyJson(ev.detail)}
							title={copy.copyPayloadJson}
						>
							{copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
						</button>
					</div>
					<pre className={s.codeViewer}>{JSON.stringify(ev.detail, null, 2)}</pre>
				</div>
			)}

			{canManage && ev.ip && (
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{copy.quickContainment}</span>
					</div>
					<div className={s.actionGroup}>
						<button
							type="button"
							className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
							onClick={() => void onQuickBan(ev.ip, `Manual quarantine via SIEM event #${ev.id}`)}
							disabled={isSubmitting}
						>
							<Ban size={13} />
							<span>{fill(copy.quarantineIpParam, { ip: ev.ip })}</span>
						</button>
						<button
							type="button"
							className={s.containmentBtn}
							onClick={() => onFilterSiemIp(ev.ip)}
						>
							<Globe size={13} />
							<span>{copy.filterInSiem}</span>
						</button>
					</div>
				</div>
			)}
		</>
	);
}
