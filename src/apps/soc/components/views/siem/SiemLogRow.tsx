'use client';

import React from 'react';
import { Eye, ChevronDown, ChevronUp, Ban } from 'lucide-react';
import { fill } from '@/lib/text';
import type { Language } from '@/lib/i18n';
import { formatDateTime } from '../../../types';
import type { SystemLog, InspectorEntity } from '../../../types';
import { formatSocAlertMessage } from '../../../utils/i18nAlertLocalization';
import type { SIEM_I18N } from './i18nSiem';
import { SiemLogDetailBox } from './SiemLogDetailBox';
import s from '../../../Soc.module.css';
import siem from '../../../SocSiem.module.css';

interface SiemLogRowProps {
	log: SystemLog;
	isExpanded: boolean;
	canManage: boolean;
	callerIp: string | null;
	isSubmitting: boolean;
	language: Language;
	copy: (typeof SIEM_I18N)['en'] | (typeof SIEM_I18N)['tr'];
	onSelectData: (e: React.MouseEvent<HTMLElement>) => void;
	onQuickExcludeLevel: (level: string) => void;
	onQuickExcludeService: (service: string) => void;
	onQuickExcludeIp: (ip: string) => void;
	onOpenInspector: (entity: InspectorEntity) => void;
	onToggleDetail: (id: number) => void;
	onPivotFilter: (key: string, value: string, op: 'eq' | 'neq') => void;
	onQuickBan: (ip: string, reason: string) => Promise<void> | void;
}

export function SiemLogRow({
	log,
	isExpanded,
	canManage,
	callerIp,
	isSubmitting,
	language,
	copy,
	onSelectData,
	onQuickExcludeLevel,
	onQuickExcludeService,
	onQuickExcludeIp,
	onOpenInspector,
	onToggleDetail,
	onPivotFilter,
	onQuickBan,
}: SiemLogRowProps) {
	const hasDetail = Boolean(log.detail && Object.keys(log.detail).length > 0);
	const sevClass =
		log.level === 'CRITICAL' || log.level === 'ERROR'
			? s.badgeDanger
			: log.level === 'WARN'
			? s.badgeWarn
			: s.badgeInfo;
	const canBanLogIp =
		canManage &&
		log.ip &&
		log.ip !== 'unknown' &&
		log.ip !== '127.0.0.1' &&
		log.ip !== '::1' &&
		log.ip !== callerIp;

	return (
		<tr>
			<td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
				<span
					data-type="timestamp"
					className={s.selectableData}
					onDoubleClick={onSelectData}
					title={copy.hintTimestamp}
				>
					{formatDateTime(log.time, language)}
				</span>
			</td>
			<td>
				<span
					data-type="level"
					className={`${s.badge} ${sevClass} ${s.selectableData}`}
					onDoubleClick={onSelectData}
					title={copy.hintLevel}
				>
					{log.level}
				</span>
				<button
					type="button"
					className={siem.quickExcludeBtn}
					title={fill(copy.excludeLevelTitle, { level: log.level })}
					onClick={() => onQuickExcludeLevel(log.level)}
				>
					≠
				</button>
			</td>
			<td>
				<span
					data-type="service"
					data-value={log.service}
					className={`${s.badge} ${s.badgeNeutral} ${s.mono} ${s.selectableData}`}
					onDoubleClick={onSelectData}
					title={copy.hintService}
				>
					{log.service}
				</span>
				<button
					type="button"
					className={siem.quickExcludeBtn}
					title={fill(copy.excludeServiceTitle, { service: log.service })}
					onClick={() => onQuickExcludeService(log.service)}
				>
					≠
				</button>
			</td>
			<td>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
					<span
						data-type="message"
						className={s.selectableData}
						onDoubleClick={onSelectData}
						title={copy.hintMessage}
					>
						{formatSocAlertMessage(log.message, language)}
						{Boolean(log.service === 'http' && log.detail?.statusCode) && (
							<span
								className={`${s.badge} ${
									Number(log.detail?.statusCode) >= 400 ? s.badgeDanger : s.badgeSuccess
								} ${s.mono}`}
								style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px' }}
							>
								{String(log.detail?.statusCode)}
							</span>
						)}
						{Boolean(log.service === 'http' && log.detail?.latencyMs !== undefined) && (
							<span
								className={`${s.badge} ${s.badgeNeutral} ${s.mono}`}
								style={{ marginLeft: 4, fontSize: 10, padding: '1px 5px' }}
							>
								{String(log.detail?.latencyMs)}ms
							</span>
						)}
					</span>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<button
							type="button"
							className={s.actionBtn}
							onClick={() => onOpenInspector({ type: 'event', data: log })}
							style={{ padding: '2px 7px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
							title={copy.inspectTitle}
						>
							<Eye size={12} />
							<span>{copy.inspectBtn}</span>
						</button>
						{hasDetail && (
							<button
								type="button"
								className={s.actionBtn}
								onClick={() => onToggleDetail(log.id)}
								style={{ padding: '2px 7px', fontSize: 11 }}
							>
								{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
								JSON
							</button>
						)}
					</div>
				</div>
				{log.userId && (
					<div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }} className={s.mono}>
						Actor:{' '}
						<span
							data-type="user"
							data-value={log.userId}
							className={s.selectableData}
							onDoubleClick={onSelectData}
							title={copy.hintActor}
						>
							{log.userId}
						</span>
					</div>
				)}
				{hasDetail && isExpanded && log.detail && (
					<SiemLogDetailBox
						detail={log.detail}
						copy={copy}
						onSelectData={onSelectData}
						onPivotFilter={onPivotFilter}
					/>
				)}
			</td>
			<td className={s.mono}>
				<span
					data-type="ip"
					data-value={log.ip}
					className={s.selectableData}
					onDoubleClick={onSelectData}
					title={copy.hintIp}
				>
					{log.ip || '—'}
				</span>
				{log.ip && log.ip !== 'unknown' && (
					<button
						type="button"
						className={siem.quickExcludeBtn}
						title={fill(copy.excludeIpTitle, { ip: log.ip })}
						onClick={() => onQuickExcludeIp(log.ip)}
					>
						≠
					</button>
				)}
			</td>
			{canManage && (
				<td>
					{canBanLogIp ? (
						<button
							type="button"
							className={`${s.actionBtn} ${s.actionBtnDanger}`}
							onClick={() =>
								void onQuickBan(log.ip, fill(copy.banReason, { id: log.id, service: log.service }))
							}
							disabled={isSubmitting}
						>
							<Ban size={12} />
							<span>{copy.banBtn}</span>
						</button>
					) : (
						<span style={{ opacity: 0.4, fontSize: 11 }}>—</span>
					)}
				</td>
			)}
		</tr>
	);
}
