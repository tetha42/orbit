'use client';

import React, { useState } from 'react';
import { CalendarDays, Plus, Scale, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import { cardStyle, gridStyle, inputStyle, labelStyle, type CommitteeDetail, type MemberOption } from './types';
import { CommitteeDecisionsSection } from './CommitteeDecisionsSection';

interface CommitteeDetailViewProps {
	detail: CommitteeDetail;
	members: MemberOption[];
	canManage: boolean;
	busy: boolean;
	formatDate: (value: number) => string;
	onAddMember: (payload: { userId: string; role: string; votingRight: boolean }) => Promise<boolean>;
	onCreateMeeting: (payload: { title: string; date: number; agenda: string }) => Promise<boolean>;
	onCreateDecision: (payload: {
		title: string;
		content: string;
		decisionType: string;
		quorumMet: boolean;
		votesFor: number;
		votesAgainst: number;
		votesAbstain: number;
	}) => Promise<boolean>;
}

export function CommitteeDetailView({
	detail,
	members,
	canManage,
	busy,
	formatDate,
	onAddMember,
	onCreateMeeting,
	onCreateDecision,
}: CommitteeDetailViewProps) {
	const { t } = useI18n();
	const [showMember, setShowMember] = useState(false);
	const [showMeeting, setShowMeeting] = useState(false);
	const [memberId, setMemberId] = useState('');
	const [memberRole, setMemberRole] = useState('Member');
	const [voting, setVoting] = useState(true);
	const [meetingTitle, setMeetingTitle] = useState('');
	const [meetingDate, setMeetingDate] = useState('');
	const [meetingAgenda, setMeetingAgenda] = useState('');

	const handleAddMember = async () => {
		const ok = await onAddMember({ userId: memberId, role: memberRole, votingRight: voting });
		if (ok) {
			setShowMember(false);
			setMemberId('');
		}
	};

	const handleCreateMeeting = async () => {
		const ok = await onCreateMeeting({
			title: meetingTitle,
			date: new Date(`${meetingDate}T12:00:00`).getTime(),
			agenda: meetingAgenda,
		});
		if (ok) {
			setShowMeeting(false);
			setMeetingTitle('');
			setMeetingAgenda('');
		}
	};

	return (
		<div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={cardStyle}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Scale size={18} style={{ color: 'var(--accent)' }} />
					<h2 style={{ margin: 0, fontSize: '17px' }}>{detail.committee.name}</h2>
					<span style={{ fontSize: '11px', opacity: 0.6 }}>
						{t('gvQuorum')}: {detail.committee.quorum ?? 0}
					</span>
				</div>
				<p style={{ margin: '6px 0 0', fontSize: '12px', opacity: 0.7 }}>{detail.committee.description}</p>
				<div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11.5px', opacity: 0.7 }}>
					<span>
						<Users size={12} /> {detail.members.length} {t('gvMembers')}
					</span>
					{detail.committee.leaderName && (
						<span>
							{t('gvLeader')}: {detail.committee.leaderName}
						</span>
					)}
				</div>
			</div>

			<div style={cardStyle}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<div style={{ fontWeight: 700, fontSize: '13px' }}>{t('gvMembers')}</div>
					{canManage && (
						<button type="button" className={ui.btn} onClick={() => setShowMember((v) => !v)}>
							<Plus size={13} /> {t('gvAddMember')}
						</button>
					)}
				</div>
				{showMember && (
					<div style={{ ...gridStyle, marginTop: '8px', alignItems: 'end' }}>
						<div>
							<label style={labelStyle}>{t('gvMember')}</label>
							<select style={inputStyle} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
								<option value="">—</option>
								{members.map((m) => (
									<option key={m.id} value={m.id}>
										{m.name} {m.surname}
									</option>
								))}
							</select>
						</div>
						<div>
							<label style={labelStyle}>{t('gvRole')}</label>
							<input style={inputStyle} value={memberRole} onChange={(e) => setMemberRole(e.target.value)} />
						</div>
						<label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
							<input type="checkbox" checked={voting} onChange={(e) => setVoting(e.target.checked)} />
							{t('gvVoting')}
						</label>
						<button type="button" className={ui.primaryBtn} disabled={!memberId || busy} onClick={() => void handleAddMember()}>
							{t('gvSave')}
						</button>
					</div>
				)}
				<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
					{detail.members.length === 0 ? (
						<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoMembers')}</div>
					) : (
						detail.members.map((member) => (
							<div
								key={member.id}
								style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '5px 0', borderTop: '1px solid var(--window-border)' }}
							>
								<span style={{ flex: 1 }}>{member.userName ?? member.userId}</span>
								<span style={{ opacity: 0.6 }}>{member.teamRole}</span>
								<span
									style={{
										fontSize: '10px',
										padding: '2px 6px',
										borderRadius: '999px',
										background: member.votingRight ? 'color-mix(in srgb, var(--success) 16%, transparent)' : 'rgba(255,255,255,0.08)',
									}}
								>
									{member.votingRight ? t('gvVoting') : t('gvNonVoting')}
								</span>
							</div>
						))
					)}
				</div>
			</div>

			<div style={cardStyle}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<div style={{ fontWeight: 700, fontSize: '13px' }}>{t('gvMeetings')}</div>
					{canManage && (
						<button type="button" className={ui.btn} onClick={() => setShowMeeting((v) => !v)}>
							<Plus size={13} /> {t('gvAddMeeting')}
						</button>
					)}
				</div>
				{showMeeting && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
						<div style={gridStyle}>
							<div>
								<label style={labelStyle}>{t('gvMeetingTitle')}</label>
								<input style={inputStyle} value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
							</div>
							<div>
								<label style={labelStyle}>{t('gvDate')}</label>
								<input style={inputStyle} type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
							</div>
						</div>
						<div>
							<label style={labelStyle}>{t('gvAgenda')}</label>
							<textarea style={{ ...inputStyle, minHeight: 50 }} value={meetingAgenda} onChange={(e) => setMeetingAgenda(e.target.value)} />
						</div>
						<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
							<button
								type="button"
								className={ui.primaryBtn}
								disabled={busy || !meetingTitle || !meetingDate}
								onClick={() => void handleCreateMeeting()}
							>
								{t('gvSave')}
							</button>
						</div>
					</div>
				)}
				<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
					{detail.meetings.length === 0 ? (
						<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoMeetings')}</div>
					) : (
						detail.meetings.map((meeting) => (
							<div key={meeting.id} style={{ fontSize: '12px', padding: '6px 0', borderTop: '1px solid var(--window-border)' }}>
								<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
									<CalendarDays size={13} style={{ opacity: 0.6 }} />
									<strong style={{ flex: 1 }}>{meeting.title}</strong>
									<span style={{ opacity: 0.6 }}>{formatDate(meeting.date)}</span>
									<span style={{ fontSize: '10px', opacity: 0.6 }}>{meeting.status}</span>
								</div>
								{meeting.agenda && <div style={{ opacity: 0.6, marginTop: '2px' }}>{meeting.agenda}</div>}
							</div>
						))
					)}
				</div>
			</div>

			<CommitteeDecisionsSection
				decisions={detail.decisions}
				canManage={canManage}
				busy={busy}
				formatDate={formatDate}
				onCreateDecision={onCreateDecision}
			/>
		</div>
	);
}
