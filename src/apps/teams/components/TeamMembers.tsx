'use client';

import React, { useState } from 'react';
import { Check, Inbox, LogOut, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useI18n, getLocaleDefinition } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { fill } from '@/lib/text';
import { CAPTAIN_ROLE, ROLE_MAX } from '@/lib/teams';
import ui from '@/core/ui/ui.module.css';
import styles from './Teams.module.css';
import { sendJson } from '@/core/data/http';
import { initials } from '@/core/text/initials';
import type { Team } from '../types';

interface Props {
	team: Team;
	currentUserId: string;
	/** Everyone in the club, for management's "add member". */
	roster: { id: string; name: string; surname: string }[];
	notify: (text: string, tone?: 'success' | 'error') => void;
	onChanged: () => Promise<void>;
}

/** Roster (roles, removal, leaving) and the applications waiting for a decision. */
export function TeamMembers({ team, currentUserId, roster, notify, onChanged }: Props) {
	const { t, language } = useI18n();
	const dialog = useDialog();
	const locale = getLocaleDefinition(language).dateLocale;
	const manage = team.permissions.manage;
	const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
	const [adding, setAdding] = useState('');

	const post = async (body: Record<string, unknown>, success?: string) => {
		const res = await sendJson<{ message?: string }>('/api/teams', 'POST', { teamId: team.id, ...body });
		if (!res.ok) notify(res.error || t('kbActionFailed'), 'error');
		else if (success) notify(success);
		else if (res.data.message) notify(res.data.message);
		await onChanged();
		return res.ok;
	};

	const saveRole = async (userId: string, current: string) => {
		const draft = roleDrafts[userId];
		setRoleDrafts((d) => {
			const next = { ...d };
			delete next[userId];
			return next;
		});
		if (draft === undefined || draft.trim() === current || !draft.trim()) return;
		await post({ action: 'setMemberRole', userId, teamRole: draft });
	};

	const memberIds = new Set(team.members.map((u) => u.userId));
	const addable = roster.filter((m) => !memberIds.has(m.id));
	const date = (ms?: number) => (ms ? new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			{manage && (
				<section className={styles.section} aria-label={t('tmApplications')}>
					<h4 className={styles.sectionHead}>
						<Inbox size={16} /> {t('tmApplications')}
						{team.applications.length > 0 && <span className={styles.tabBadge}>{team.applications.length}</span>}
					</h4>
					{team.applications.length === 0 ? (
						<div className={ui.muted}>{t('tmNoApplications')}</div>
					) : (
						team.applications.map((b) => (
							<div key={b.userId} className={styles.application} data-applicant-id={b.userId}>
								<span className={ui.avatar} style={{ marginLeft: 0, width: 32, height: 32, fontSize: 12 }}>
									{initials(b.userName)}
								</span>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div className={styles.memberName}>{b.userName}</div>
									<div className={styles.memberSub}>
										{b.userDepartment} · {date(b.joinedAt)}
									</div>
								</div>
								<button
									type="button"
									className={ui.primaryBtn}
									style={{ height: 30, background: 'var(--success)' }}
									onClick={() => post({ action: 'approve', userId: b.userId }, t('tmApprovedToast'))}
								>
									<Check size={14} /> {t('tmApprove')}
								</button>
								<button
									type="button"
									className={`${ui.btn} ${ui.btnDanger}`}
									onClick={async () => {
										if (await dialog.confirm({ message: fill(t('tmRejectConfirm'), { name: b.userName }), tone: 'danger' })) {
											await post({ action: 'reject', userId: b.userId }, t('tmRejectedToast'));
										}
									}}
								>
									<X size={14} /> {t('tmReject')}
								</button>
								{b.applicationNote && <div className={styles.applicationNote}>{b.applicationNote}</div>}
							</div>
						))
					)}
				</section>
			)}

			<section className={styles.section} aria-label={t('tmRoster')}>
				<h4 className={styles.sectionHead}>
					<Users size={16} /> {t('tmRoster')}
					<span className={ui.count}>
						{team.fullCapacity}/{team.capacity}
					</span>
					{team.permissions.editAll && addable.length > 0 && (
						<span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
							<select className={ui.select} value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={t('tmAddMember')}>
								<option value="">{t('tmAddMemberPh')}</option>
								{addable.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name} {m.surname}
									</option>
								))}
							</select>
							<button
								type="button"
								className={ui.btn}
								disabled={!adding}
								onClick={async () => {
									if (await post({ action: 'addMember', userId: adding }, t('tmMemberAddedToast'))) setAdding('');
								}}
							>
								<UserPlus size={14} /> {t('tmAddMember')}
							</button>
						</span>
					)}
				</h4>
				<div className={styles.roster}>
					{team.members.map((u) => {
						const isCaptain = u.userId === team.leadId;
						const isMe = u.userId === currentUserId;
						return (
							<div key={u.userId} className={styles.memberCard} data-member-id={u.userId}>
								<span
									className={ui.avatar}
									style={{ marginLeft: 0, width: 36, height: 36, fontSize: 13, background: isCaptain ? 'linear-gradient(135deg,var(--warning),#ff375f)' : undefined }}
								>
									{initials(u.userName)}
								</span>
								<div className={styles.memberMain}>
									<div className={styles.memberName}>
										{u.userName} {isMe && <span className={ui.muted}>({t('tmYou')})</span>}
									</div>
									<input
										className={styles.roleInput}
										value={roleDrafts[u.userId] ?? u.teamRole}
										maxLength={ROLE_MAX}
										disabled={!manage || isCaptain}
										aria-label={`${t('tmRole')}: ${u.userName}`}
										title={isCaptain ? CAPTAIN_ROLE : t('tmRole')}
										onChange={(e) => setRoleDrafts((d) => ({ ...d, [u.userId]: e.target.value }))}
										onBlur={() => saveRole(u.userId, u.teamRole)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
										}}
									/>
									<div className={styles.memberSub}>
										{u.userDepartment}
										{u.joinedAt ? ` · ${fill(t('tmJoined'), { date: date(u.joinedAt) })}` : ''}
									</div>
								</div>
								{manage && !isCaptain && !isMe && (
									<button
										type="button"
										className={ui.iconBtn}
										title={t('tmRemove')}
										aria-label={`${t('tmRemove')}: ${u.userName}`}
										onClick={async () => {
											if (await dialog.confirm({ message: fill(t('tmRemoveConfirm'), { name: u.userName }), tone: 'danger' })) {
												await post({ action: 'removeMember', userId: u.userId }, t('tmMemberRemovedToast'));
											}
										}}
									>
										<UserMinus size={15} />
									</button>
								)}
								{isMe && !isCaptain && (
									<button
										type="button"
										className={ui.iconBtn}
										title={t('tmLeave')}
										aria-label={t('tmLeave')}
										onClick={async () => {
											if (await dialog.confirm({ message: fill(t('tmLeaveConfirm'), { team: team.name }), tone: 'warning' })) {
												await post({ action: 'leave' }, t('tmLeftToast'));
											}
										}}
									>
										<LogOut size={15} />
									</button>
								)}
							</div>
						);
					})}
				</div>
			</section>
		</div>
	);
}
