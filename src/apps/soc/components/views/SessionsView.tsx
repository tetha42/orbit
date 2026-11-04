'use client';

import React, { useMemo } from 'react';
import {
	Users,
	AlertTriangle,
	LogOut,
	UserX,
	Ban,
	Terminal,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { formatDateTime, summarizeUa } from '../../types';
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
		language,
		isEn,
		globalSearch,
	} = useSoc();

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
							{isEn
								? 'Active Sessions, Device Telemetry & Hijack Shield'
								: 'Aktif Oturumlar, Cihaz Telemetrisi ve Oturum Çalma (Hijack) Kalkanı'}
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Monitors mid-session IP changes and allows instant remote session & PTY terminal termination'
								: 'Oturum içi IP değişimlerini tespit eder; şüpheli oturumları ve açık PTY terminallerini anında kapatır'}
						</p>
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
								<span>{isEn ? 'Drop All Suspicious Sessions' : 'Tüm Şüpheli Oturumları Düşür'}</span>
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
									<span>{isEn ? 'Revoke All Other Sessions' : 'Diğer Tüm Oturumları Düşür'}</span>
								</button>
							)}
						</div>
					)}
				</div>

				{filteredSessions.length === 0 ? (
					<div className={s.emptyState}>
						{isEn
							? query
								? 'No active sessions match your search query.'
								: 'No active sessions found.'
							: query
							? 'Arama kriterine uygun aktif oturum bulunamadı.'
							: 'Aktif kullanıcı oturumu bulunamadı.'}
					</div>
				) : (
					<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>{isEn ? 'Member' : 'Kullanıcı'}</th>
									<th>{isEn ? 'Role & 2FA' : 'Role & 2FA'}</th>
									<th>{isEn ? 'Login IP → Active IP' : 'Giriş IP → Aktif IP'}</th>
									<th>{isEn ? 'Device / User-Agent' : 'Cihaz / Tarayıcı'}</th>
									<th>{isEn ? 'Last Active' : 'Son Aktivite'}</th>
									{canManage && <th>{isEn ? 'Response' : 'Müdahale'}</th>}
								</tr>
							</thead>
							<tbody>
								{filteredSessions.map((sess) => {
									const isSelf = sess.id === currentUserId;
									return (
										<tr
											key={sess.id}
											style={{ cursor: 'pointer' }}
											onClick={() => openInspector({ type: 'session', data: sess })}
										>
											<td>
												<div style={{ fontWeight: 700 }}>
													<span
														data-type="user"
														data-value={sess.id}
														className={s.selectableData}
														onDoubleClick={handleSelectDataOnDoubleClick}
														title={isEn ? 'Right-click for pivoting menu' : 'Sağ tıklayarak menüyü açın'}
													>
														{sess.name} {sess.surname}
													</span>{' '}
													{isSelf && (
														<span className={`${s.badge} ${s.badgeInfo}`}>
															{isEn ? 'You' : 'Siz'}
														</span>
													)}
												</div>
												<div
													style={{ fontSize: 11.5, opacity: 0.65 }}
													data-type="user-email"
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select email' : 'E-postayı seçmek için çift tıklayın'}
												>
													{sess.email}
												</div>
											</td>
											<td>
												<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
													<span
														data-type="role"
														className={`${s.badge} ${sess.admin ? s.badgeDanger : s.badgeNeutral} ${s.selectableData}`}
														onDoubleClick={handleSelectDataOnDoubleClick}
														title={isEn ? 'Double-click to select role' : 'Roleü seçmek için çift tıklayın'}
													>
														{sess.roleName}
													</span>
													<span className={`${s.badge} ${sess.totpEnabled ? s.badgeSuccess : s.badgeWarn}`}>
														{sess.totpEnabled ? '2FA' : isEn ? 'No 2FA' : '2FA Yok'}
													</span>
												</div>
											</td>
											<td>
												<div className={s.mono}>
													{sess.lastLoginIp ? (
														<span
															data-type="ip"
															className={s.selectableData}
															onDoubleClick={handleSelectDataOnDoubleClick}
															title={isEn ? 'Double-click to select login IP' : 'Giriş IP seçmek için çift tıklayın'}
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
															onDoubleClick={handleSelectDataOnDoubleClick}
															title={isEn ? 'Double-click to select active IP' : 'Aktif IP seçmek için çift tıklayın'}
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
															style={{ background: 'rgba(255, 59, 48, 0.2)', color: '#d70015', border: '1px solid rgba(255, 59, 48, 0.4)' }}
															title={sess.impossibleTravel.reason}
														>
															<AlertTriangle size={11} />
															{isEn
																? `IMPOSSIBLE TRAVEL (~${sess.impossibleTravel.speedKmh} km/h)`
																: `İMKANSIZ SEYAHAT (~${sess.impossibleTravel.speedKmh} km/s)`}
														</span>
													</div>
												) : sess.ipChanged ? (
													<div style={{ marginTop: 4 }}>
														<span className={`${s.badge} ${s.badgeDanger}`}>
															<AlertTriangle size={11} />
															{isEn ? 'IP CHANGED (HIJACK RISK)' : 'IP DEĞİŞİMİ (ANOMALİ)'}
														</span>
													</div>
												) : null}
											</td>
											<td title={sess.lastLoginUserAgent || ''}>
												<span style={{ fontSize: 11.5, opacity: 0.8 }}>
													{summarizeUa(sess.lastLoginUserAgent)}
												</span>
											</td>
											<td>{formatDateTime(sess.lastActiveDate || sess.lastLoginDate, language)}</td>
											{canManage && (
												<td onClick={(e) => e.stopPropagation()}>
													<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
														{!isSelf && (
															<button
																type="button"
																className={s.actionBtn}
																onClick={() => void handleKillSession(sess)}
																disabled={isSubmitting}
															>
																<LogOut size={12} />
																<span>{isEn ? 'Drop' : 'Düşür'}</span>
															</button>
														)}
														{!isSelf && (
															<button
																type="button"
																className={s.actionBtn}
																onClick={() => void handleKillUserTerminals(sess.id)}
																disabled={isSubmitting}
																title={isEn ? 'Kill all active Linux PTY terminal shells' : 'Kullanıcının aktif terminal süreçlerini kapat'}
															>
																<Terminal size={12} />
																<span>{isEn ? 'Kill PTY' : 'PTY Kapat'}</span>
															</button>
														)}
														{!isSelf && !sess.admin && (
															<button
																type="button"
																className={`${s.actionBtn} ${s.actionBtnDanger}`}
																onClick={() => void handleSuspendUser(sess)}
																disabled={isSubmitting}
															>
																<UserX size={12} />
																<span>{isEn ? 'Suspend' : 'Askıya Al'}</span>
															</button>
														)}
														{!isSelf &&
															sess.lastActiveIp &&
															sess.lastActiveIp !== callerIp && (
																<button
																	type="button"
																	className={`${s.actionBtn} ${s.actionBtnDanger}`}
																	onClick={() =>
																		void handleQuickBan(
																			sess.lastActiveIp!,
																			isEn
																				? `Suspicious session IP quarantine (${sess.email})`
																				: `Şüpheli oturum IP karantinası (${sess.email})`
																		)
																	}
																	disabled={isSubmitting}
																>
																	<Ban size={12} />
																	<span>{isEn ? 'IP Ban' : 'IP Engelle'}</span>
																</button>
															)}
													</div>
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
});
