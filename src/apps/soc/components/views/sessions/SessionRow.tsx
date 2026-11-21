'use client';

import React from 'react';
import { AlertTriangle, LogOut, UserX, Ban, Terminal } from 'lucide-react';
import { fill } from '@/lib/text';
import type { Language } from '@/lib/i18n';
import { formatDateTime, summarizeUa } from '../../../types';
import type { ActiveSessionInfo, InspectorEntity } from '../../../types';
import type { SESSIONS_I18N } from './i18nSessions';
import s from '../../../Soc.module.css';

interface SessionRowProps {
	sess: ActiveSessionInfo;
	isSelf: boolean;
	canManage: boolean;
	isSubmitting: boolean;
	callerIp: string | null;
	language: Language;
	copy: (typeof SESSIONS_I18N)['en'] | (typeof SESSIONS_I18N)['tr'];
	onOpenInspector: (entity: InspectorEntity) => void;
	onSelectData: (e: React.MouseEvent<HTMLElement>) => void;
	onKillSession: (sess: ActiveSessionInfo) => Promise<void> | void;
	onKillUserTerminals: (userId: string) => Promise<unknown> | void;
	onSuspendUser: (sess: ActiveSessionInfo) => Promise<void> | void;
	onQuickBan: (ip: string, reason: string) => Promise<void> | void;
}

export function SessionRow({
	sess,
	isSelf,
	canManage,
	isSubmitting,
	callerIp,
	language,
	copy,
	onOpenInspector,
	onSelectData,
	onKillSession,
	onKillUserTerminals,
	onSuspendUser,
	onQuickBan,
}: SessionRowProps) {
	return (
		<tr style={{ cursor: 'pointer' }} onClick={() => onOpenInspector({ type: 'session', data: sess })}>
			<td>
				<div style={{ fontWeight: 700 }}>
					<span
						data-type="user"
						data-value={sess.id}
						className={s.selectableData}
						onDoubleClick={onSelectData}
						title={copy.hintMenu}
					>
						{sess.name} {sess.surname}
					</span>{' '}
					{isSelf && <span className={`${s.badge} ${s.badgeInfo}`}>{copy.youBadge}</span>}
				</div>
				<div
					style={{ fontSize: 11.5, opacity: 0.65 }}
					data-type="user-email"
					className={s.selectableData}
					onDoubleClick={onSelectData}
					title={copy.hintEmail}
				>
					{sess.email}
				</div>
			</td>
			<td>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
					<span
						data-type="role"
						className={`${s.badge} ${sess.admin ? s.badgeDanger : s.badgeNeutral} ${s.selectableData}`}
						onDoubleClick={onSelectData}
						title={copy.hintRole}
					>
						{sess.roleName}
					</span>
					<span className={`${s.badge} ${sess.totpEnabled ? s.badgeSuccess : s.badgeWarn}`}>
						{sess.totpEnabled ? '2FA' : copy.no2fa}
					</span>
				</div>
			</td>
			<td>
				<div className={s.mono}>
					{sess.lastLoginIp ? (
						<span
							data-type="ip"
							className={s.selectableData}
							onDoubleClick={onSelectData}
							title={copy.hintLoginIp}
						>
							{sess.lastLoginIp}
						</span>
					) : (
						'—'
					)}{' '}
					→{' '}
					{sess.lastActiveIp ? (
						<span
							data-type="ip"
							className={s.selectableData}
							onDoubleClick={onSelectData}
							title={copy.hintActiveIp}
						>
							{sess.lastActiveIp}
						</span>
					) : (
						sess.lastLoginIp || '—'
					)}
				</div>
				{sess.impossibleTravel?.detected ? (
					<div style={{ marginTop: 4 }}>
						<span
							className={`${s.badge} ${s.badgeDanger}`}
							style={{
								background: 'color-mix(in srgb, var(--danger) 20%, transparent)',
								color: 'var(--danger)',
								border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
							}}
							title={sess.impossibleTravel.reason}
						>
							<AlertTriangle size={11} />
							{fill(copy.impossibleTravel, { speed: sess.impossibleTravel.speedKmh ?? 0 })}
						</span>
					</div>
				) : sess.ipChanged ? (
					<div style={{ marginTop: 4 }}>
						<span className={`${s.badge} ${s.badgeDanger}`}>
							<AlertTriangle size={11} />
							{copy.ipChanged}
						</span>
					</div>
				) : null}
			</td>
			<td title={sess.lastLoginUserAgent || ''}>
				<span style={{ fontSize: 11.5, opacity: 0.8 }}>{summarizeUa(sess.lastLoginUserAgent)}</span>
			</td>
			<td>{formatDateTime(sess.lastActiveDate || sess.lastLoginDate, language)}</td>
			{canManage && (
				<td onClick={(e) => e.stopPropagation()}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
						{!isSelf && (
							<button
								type="button"
								className={s.actionBtn}
								onClick={() => void onKillSession(sess)}
								disabled={isSubmitting}
							>
								<LogOut size={12} />
								<span>{copy.btnDrop}</span>
							</button>
						)}
						{!isSelf && (
							<button
								type="button"
								className={s.actionBtn}
								onClick={() => void onKillUserTerminals(sess.id)}
								disabled={isSubmitting}
								title={copy.hintKillPty}
							>
								<Terminal size={12} />
								<span>{copy.btnKillPty}</span>
							</button>
						)}
						{!isSelf && !sess.admin && (
							<button
								type="button"
								className={`${s.actionBtn} ${s.actionBtnDanger}`}
								onClick={() => void onSuspendUser(sess)}
								disabled={isSubmitting}
							>
								<UserX size={12} />
								<span>{copy.btnSuspend}</span>
							</button>
						)}
						{!isSelf && sess.lastActiveIp && sess.lastActiveIp !== callerIp && (
							<button
								type="button"
								className={`${s.actionBtn} ${s.actionBtnDanger}`}
								onClick={() =>
									void onQuickBan(sess.lastActiveIp!, fill(copy.banReason, { email: sess.email }))
								}
								disabled={isSubmitting}
							>
								<Ban size={12} />
								<span>{copy.btnIpBan}</span>
							</button>
						)}
					</div>
				</td>
			)}
		</tr>
	);
}
