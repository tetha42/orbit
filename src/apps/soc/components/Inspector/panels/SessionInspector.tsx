'use client';

import React from 'react';
import { ShieldAlert, Lock, Terminal, ExternalLink } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { formatDateTime, summarizeUa } from '../../../types';
import type { ActiveSessionInfo } from '../../../types';
import type { INSPECTOR_I18N } from '../i18nInspector';
import s from '../SocInspector.module.css';

interface SessionInspectorProps {
	sess: ActiveSessionInfo;
	canManage: boolean;
	isSubmitting: boolean;
	language: Language;
	copy: (typeof INSPECTOR_I18N)['en'] | (typeof INSPECTOR_I18N)['tr'];
	onKillSession: (sess: ActiveSessionInfo) => Promise<void> | void;
	onKillUserTerminals: (userId: string) => Promise<unknown> | void;
	onOpenMemberProfile: (userId: string) => void;
}

export function SessionInspector({
	sess,
	canManage,
	isSubmitting,
	language,
	copy,
	onKillSession,
	onKillUserTerminals,
	onOpenMemberProfile,
}: SessionInspectorProps) {
	return (
		<>
			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.userIdentity}</span>
					<span className={`${s.badge} ${sess.admin ? s.badgeDanger : s.badgeNeutral}`}>
						{sess.admin ? 'ADMIN' : sess.roleName || 'MEMBER'}
					</span>
				</div>
				<div className={s.gridProps}>
					<span className={s.propLabel}>{copy.name}</span>
					<span className={s.propValue}>
						{sess.name} {sess.surname}
					</span>

					<span className={s.propLabel}>{copy.email}</span>
					<span className={s.propValue}>{sess.email}</span>

					<span className={s.propLabel}>{copy.userIdLabel}</span>
					<span className={`${s.propValue} ${s.mono}`} data-type="user" data-value={sess.id}>
						{sess.id}
					</span>

					<span className={s.propLabel}>{copy.twoFaLabel}</span>
					<span className={s.propValue}>{sess.totpEnabled ? copy.twoFaActive : copy.twoFaDisabled}</span>
				</div>
			</div>

			<div className={s.sectionCard}>
				<div className={s.sectionHeader}>
					<span>{copy.sessionTelemetry}</span>
				</div>
				<div className={s.gridProps}>
					<span className={s.propLabel}>{copy.clientIp}</span>
					<span
						className={`${s.propValue} ${s.mono}`}
						data-type="ip"
						data-value={sess.lastActiveIp || sess.lastLoginIp || ''}
					>
						{sess.lastActiveIp || sess.lastLoginIp || '—'}
					</span>

					<span className={s.propLabel}>{copy.userAgent}</span>
					<span className={s.propValue} title={sess.lastLoginUserAgent || ''}>
						{summarizeUa(sess.lastLoginUserAgent)}
					</span>

					<span className={s.propLabel}>{copy.lastActive}</span>
					<span className={s.propValue}>{formatDateTime(sess.lastActiveDate, language)}</span>
				</div>
			</div>

			{sess.impossibleTravel?.detected && (
				<div className={s.sectionCard} style={{ borderColor: 'var(--danger)' }}>
					<div className={s.sectionHeader}>
						<span style={{ color: 'var(--danger)' }}>{copy.impossibleTravelTitle}</span>
						<ShieldAlert size={14} color="var(--danger)" />
					</div>
					<p style={{ fontSize: 12, margin: 0, color: 'var(--text-secondary)' }}>
						{sess.impossibleTravel.reason || copy.impossibleTravelDefault}
					</p>
				</div>
			)}

			{canManage && (
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{copy.shieldContainment}</span>
					</div>
					<div className={s.actionGroup}>
						<button
							type="button"
							className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
							onClick={() => void onKillSession(sess)}
							disabled={isSubmitting}
						>
							<Lock size={13} />
							<span>{copy.terminateSession}</span>
						</button>

						<button
							type="button"
							className={s.containmentBtn}
							onClick={() => void onKillUserTerminals(sess.id)}
							disabled={isSubmitting}
						>
							<Terminal size={13} />
							<span>{copy.killPtyShells}</span>
						</button>

						<button
							type="button"
							className={s.containmentBtn}
							onClick={() => onOpenMemberProfile(sess.id)}
						>
							<ExternalLink size={13} />
							<span>{copy.jumpToMember}</span>
						</button>
					</div>
				</div>
			)}
		</>
	);
}
