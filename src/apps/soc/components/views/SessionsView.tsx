'use client';

import React, { useMemo } from 'react';
import { Users, AlertTriangle, LogOut } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import { SESSIONS_I18N } from './sessions/i18nSessions';
import { SessionRow } from './sessions/SessionRow';
import s from '../../Soc.module.css';

export const SessionsView = React.memo(function SessionsView() {
	const {
		sessions,
		currentUserId,
		callerIp,
		canManage,
		isSubmitting,
		handleKillSession,
		handleKillAllOtherSessions,
		handleRevokeAnomalousSessions,
		handleSuspendUser,
		handleQuickBan,
		handleKillUserTerminals,
		openInspector,
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
		globalSearch,
	} = useSoc();
	const { language } = useI18n();
	const copy = SESSIONS_I18N[language] ?? SESSIONS_I18N.en;

	const query = globalSearch.trim().toLowerCase();
	const filteredSessions = useMemo(() => {
		return sessions.filter((sess) => {
			if (!query) return true;
			const name = `${sess.name} ${sess.surname}`.toLowerCase();
			return (
				name.includes(query) ||
				sess.email.toLowerCase().includes(query) ||
				(sess.roleName && sess.roleName.toLowerCase().includes(query)) ||
				(sess.lastLoginIp && sess.lastLoginIp.toLowerCase().includes(query)) ||
				(sess.lastActiveIp && sess.lastActiveIp.toLowerCase().includes(query)) ||
				(sess.lastLoginUserAgent && sess.lastLoginUserAgent.toLowerCase().includes(query))
			);
		});
	}, [sessions, query]);

	return (
		<div className={s.viewContainer}>
			<section className={s.card}>
				<div className={s.cardHeader}>
					<div>
						<h2 className={s.cardTitle}>
							<Users size={16} />
							{copy.title}
						</h2>
						<p className={s.cardSub}>{copy.subtitle}</p>
					</div>

					{canManage && (
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
							<button
								type="button"
								className={`${s.actionBtn} ${s.actionBtnDanger}`}
								onClick={() => void handleRevokeAnomalousSessions()}
								disabled={isSubmitting}
								style={{ padding: '7px 12px' }}
							>
								<AlertTriangle size={13} />
								<span>{copy.dropSuspicious}</span>
							</button>
							{sessions.length > 1 && (
								<button
									type="button"
									className={`${s.actionBtn} ${s.actionBtnDanger}`}
									onClick={() => void handleKillAllOtherSessions()}
									disabled={isSubmitting}
									style={{ padding: '7px 12px' }}
								>
									<LogOut size={13} />
									<span>{copy.revokeOthers}</span>
								</button>
							)}
						</div>
					)}
				</div>

				{filteredSessions.length === 0 ? (
					<div className={s.emptyState}>{query ? copy.emptyFiltered : copy.emptyAll}</div>
				) : (
					<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>{copy.colMember}</th>
									<th>{copy.colRole2fa}</th>
									<th>{copy.colIpTransition}</th>
									<th>{copy.colDevice}</th>
									<th>{copy.colLastActive}</th>
									{canManage && <th>{copy.colResponse}</th>}
								</tr>
							</thead>
							<tbody>
								{filteredSessions.map((sess) => (
									<SessionRow
										key={sess.sessionId ? `${sess.id}:${sess.sessionId}` : sess.id}
										sess={sess}
										isSelf={sess.id === currentUserId}
										canManage={canManage}
										isSubmitting={isSubmitting}
										callerIp={callerIp}
										language={language}
										copy={copy}
										onOpenInspector={openInspector}
										onSelectData={handleSelectDataOnDoubleClick}
										onKillSession={handleKillSession}
										onKillUserTerminals={handleKillUserTerminals}
										onSuspendUser={handleSuspendUser}
										onQuickBan={handleQuickBan}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
});
