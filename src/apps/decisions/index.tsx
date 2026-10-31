'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Plus, Scale, Users, Vote } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useAppCommand } from '@/core/commands';
import ui from '@/core/ui/ui.module.css';
import { errorMessage } from '@/lib/errors';

interface Committee {
	id: string;
	ad: string;
	slug: string;
	aciklama: string;
	kategori: string;
	liderId?: string | null;
	liderAdSoyad?: string | null;
	aktifUyeSayisi?: number;
	quorum?: number;
	olusturma: number;
}

interface CommitteeMember {
	id: string;
	userId: string;
	kullaniciAdSoyad?: string;
	kullaniciBolum?: string;
	takimRolu: string;
	votingRight?: number;
	termStart?: number | null;
	termEnd?: number | null;
}

interface Meeting {
	id: string;
	title: string;
	date: number;
	agenda: string;
	minutes: string;
	status: string;
}

interface Decision {
	id: string;
	kararNo: number;
	baslik: string;
	date: number;
	gundem: string;
	icerik: string;
	bodyId?: string | null;
	bodyAd?: string | null;
	decisionType?: string;
	quorumMet?: number;
	votesFor?: number;
	votesAgainst?: number;
	votesAbstain?: number;
	kamuyaAcikMi: number;
}

interface CommitteeDetail {
	committee: Committee;
	members: CommitteeMember[];
	meetings: Meeting[];
	decisions: Decision[];
}

interface MemberOption {
	id: string;
	ad: string;
	soyad: string;
	email: string;
	bolum?: string;
}

const input: React.CSSProperties = {
	width: '100%',
	padding: '8px 10px',
	borderRadius: '7px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0,0,0,0.22)',
	color: 'inherit',
	fontSize: '12px',
	boxSizing: 'border-box',
};
const label: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, opacity: 0.75, marginBottom: '4px' };
const card: React.CSSProperties = {
	padding: '12px',
	borderRadius: '9px',
	border: '1px solid var(--window-border)',
	background: 'rgba(255,255,255,0.025)',
};
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' };

export function DecisionsApp() {
	const { t, language } = useI18n();
	const session = useSession();
	const canManage = session.canManageApp('decisions');
	const [tab, setTab] = useState<'committees' | 'decisions'>('committees');
	const [committees, setCommittees] = useState<Committee[]>([]);
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [members, setMembers] = useState<MemberOption[]>([]);
	const [detail, setDetail] = useState<CommitteeDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState<string | null>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [showMember, setShowMember] = useState(false);
	const [showMeeting, setShowMeeting] = useState(false);
	const [showDecision, setShowDecision] = useState(false);
	const [busy, setBusy] = useState(false);

	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [quorum, setQuorum] = useState('3');
	const [leaderId, setLeaderId] = useState('');
	const [memberId, setMemberId] = useState('');
	const [memberRole, setMemberRole] = useState('Member');
	const [voting, setVoting] = useState(true);
	const [meetingTitle, setMeetingTitle] = useState('');
	const [meetingDate, setMeetingDate] = useState('');
	const [meetingAgenda, setMeetingAgenda] = useState('');
	const [decisionTitle, setDecisionTitle] = useState('');
	const [decisionContent, setDecisionContent] = useState('');
	const [decisionType, setDecisionType] = useState('resolution');
	const [votesFor, setVotesFor] = useState('0');
	const [votesAgainst, setVotesAgainst] = useState('0');
	const [votesAbstain, setVotesAbstain] = useState('0');
	const [quorumMet, setQuorumMet] = useState(true);

	const formatDate = (value: number) =>
		new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium' }).format(new Date(value));

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [committeeRes, decisionRes, memberRes] = await Promise.all([
				fetch('/api/committees', { cache: 'no-store' }),
				fetch('/api/decisions', { cache: 'no-store' }),
				fetch('/api/committees/members', { cache: 'no-store' }),
			]);
			const committeeData = committeeRes.ok ? await committeeRes.json() : null;
			const decisionData = decisionRes.ok ? await decisionRes.json() : null;
			const memberData = memberRes.ok ? await memberRes.json() : null;
			setCommittees(committeeData?.committees ?? []);
			setDecisions(Array.isArray(decisionData) ? decisionData : []);
			setMembers(memberData?.members ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	const loadDetail = useCallback(async (id: string) => {
		const res = await fetch(`/api/committees?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
		const data = await res.json().catch(() => null);
		if (res.ok) setDetail(data);
		else setMessage(data?.error || t('gvActionFailed'));
	}, [t]);

	useEffect(() => {
		void load();
	}, [load]);

	useAppCommand(
		'decisions',
		(cmd) => {
			if (cmd === 'new-committee') {
				if (canManage) setShowCreate(true);
				else setMessage(t('gvNoPermission'));
			}
		},
		true
	);

	const post = async (url: string, body: Record<string, unknown>) => {
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error || t('gvActionFailed'));
			await load();
			if (detail) await loadDetail(detail.committee.id);
			return true;
		} catch (error) {
			setMessage(errorMessage(error) || t('gvActionFailed'));
			return false;
		} finally {
			setBusy(false);
		}
	};

	const createCommittee = async () => {
		const ok = await post('/api/committees', {
			action: 'createCommittee',
			ad: name,
			aciklama: description,
			quorum: Number(quorum) || 0,
			liderId: leaderId || undefined,
		});
		if (ok) {
			setName('');
			setDescription('');
			setShowCreate(false);
			setMessage(t('gvCreated'));
		}
	};

	const addMember = async () => {
		if (!detail) return;
		const ok = await post('/api/committees', {
			action: 'addMember',
			committeeId: detail.committee.id,
			userId: memberId,
			role: memberRole,
			votingRight: voting,
		});
		if (ok) {
			setShowMember(false);
			setMemberId('');
		}
	};

	const createMeeting = async () => {
		if (!detail) return;
		const ok = await post('/api/committees', {
			action: 'createMeeting',
			committeeId: detail.committee.id,
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

	const createDecision = async () => {
		if (!detail) return;
		const ok = await post('/api/decisions', {
			baslik: decisionTitle,
			icerik: decisionContent,
			gundem: '',
			bodyId: detail.committee.id,
			decisionType,
			quorumMet,
			votesFor: Number(votesFor) || 0,
			votesAgainst: Number(votesAgainst) || 0,
			votesAbstain: Number(votesAbstain) || 0,
		});
		if (ok) {
			setShowDecision(false);
			setDecisionTitle('');
			setDecisionContent('');
			setMessage(t('gvDecisionCreated'));
		}
	};

	if (loading) return <div style={{ padding: 24 }}>{t('loading')}</div>;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '18px 20px', gap: '14px' }}>
			<header style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
				{detail ? (
					<button type="button" className={ui.btn} onClick={() => setDetail(null)}>
						<ArrowLeft size={14} /> {t('gvBack')}
					</button>
				) : (
					<div style={{ display: 'flex', gap: '6px' }}>
						<button
							type="button"
							className={tab === 'committees' ? ui.primaryBtn : ui.btn}
							onClick={() => setTab('committees')}
						>
							<Scale size={14} /> {t('gvCommittees')}
						</button>
						<button
							type="button"
							className={tab === 'decisions' ? ui.primaryBtn : ui.btn}
							onClick={() => setTab('decisions')}
						>
							<Vote size={14} /> {t('gvDecisions')}
						</button>
					</div>
				)}
				<div style={{ flex: 1 }} />
				{!detail && tab === 'committees' && canManage && (
					<button type="button" className={ui.primaryBtn} onClick={() => setShowCreate(true)}>
						<Plus size={14} /> {t('gvNewCommittee')}
					</button>
				)}
			</header>

			{message && (
				<div style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '7px', background: 'rgba(10,132,255,0.12)' }}>
					{message}
				</div>
			)}

			{showCreate && (
				<div style={card}>
					<div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>{t('gvNewCommittee')}</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<div>
							<label style={label}>{t('gvCommitteeName')}</label>
							<input style={input} value={name} onChange={(e) => setName(e.target.value)} />
						</div>
						<div>
							<label style={label}>{t('gvDescription')}</label>
							<textarea style={{ ...input, minHeight: 56 }} value={description} onChange={(e) => setDescription(e.target.value)} />
						</div>
						<div style={grid}>
							<div>
								<label style={label}>{t('gvQuorum')}</label>
								<input style={input} type="number" min={0} value={quorum} onChange={(e) => setQuorum(e.target.value)} />
							</div>
							<div>
								<label style={label}>{t('gvLeader')}</label>
								<select style={input} value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
									<option value="">{t('gvNoLeader')}</option>
									{members.map((m) => (
										<option key={m.id} value={m.id}>{m.ad} {m.soyad}</option>
									))}
								</select>
							</div>
						</div>
						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
							<button type="button" className={ui.btn} onClick={() => setShowCreate(false)}>{t('gvCancel')}</button>
							<button type="button" className={ui.primaryBtn} disabled={busy} onClick={() => void createCommittee()}>{t('gvSave')}</button>
						</div>
					</div>
				</div>
			)}

			{detail ? (
				<div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
					<div style={card}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Scale size={18} style={{ color: 'var(--accent)' }} />
							<h2 style={{ margin: 0, fontSize: '17px' }}>{detail.committee.ad}</h2>
							<span style={{ fontSize: '11px', opacity: 0.6 }}>
								{t('gvQuorum')}: {detail.committee.quorum ?? 0}
							</span>
						</div>
						<p style={{ margin: '6px 0 0', fontSize: '12px', opacity: 0.7 }}>{detail.committee.aciklama}</p>
						<div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11.5px', opacity: 0.7 }}>
							<span><Users size={12} /> {detail.members.length} {t('gvMembers')}</span>
							{detail.committee.liderAdSoyad && <span>{t('gvLeader')}: {detail.committee.liderAdSoyad}</span>}
						</div>
					</div>

					<div style={card}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<div style={{ fontWeight: 700, fontSize: '13px' }}>{t('gvMembers')}</div>
							{canManage && (
								<button type="button" className={ui.btn} onClick={() => setShowMember((v) => !v)}>
									<Plus size={13} /> {t('gvAddMember')}
								</button>
							)}
						</div>
						{showMember && (
							<div style={{ ...grid, marginTop: '8px', alignItems: 'end' }}>
								<div>
									<label style={label}>{t('gvMember')}</label>
									<select style={input} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
										<option value="">—</option>
										{members.map((m) => (
											<option key={m.id} value={m.id}>{m.ad} {m.soyad}</option>
										))}
									</select>
								</div>
								<div>
									<label style={label}>{t('gvRole')}</label>
									<input style={input} value={memberRole} onChange={(e) => setMemberRole(e.target.value)} />
								</div>
								<label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
									<input type="checkbox" checked={voting} onChange={(e) => setVoting(e.target.checked)} />
									{t('gvVoting')}
								</label>
								<button type="button" className={ui.primaryBtn} disabled={!memberId || busy} onClick={() => void addMember()}>{t('gvSave')}</button>
							</div>
						)}
						<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
							{detail.members.length === 0 ? (
								<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoMembers')}</div>
							) : (
								detail.members.map((member) => (
									<div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '5px 0', borderTop: '1px solid var(--window-border)' }}>
										<span style={{ flex: 1 }}>{member.kullaniciAdSoyad ?? member.userId}</span>
										<span style={{ opacity: 0.6 }}>{member.takimRolu}</span>
										<span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '999px', background: member.votingRight ? 'rgba(48,209,88,0.16)' : 'rgba(255,255,255,0.08)' }}>
											{member.votingRight ? t('gvVoting') : t('gvNonVoting')}
										</span>
									</div>
								))
							)}
						</div>
					</div>

					<div style={card}>
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
								<div style={grid}>
									<div>
										<label style={label}>{t('gvMeetingTitle')}</label>
										<input style={input} value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
									</div>
									<div>
										<label style={label}>{t('gvDate')}</label>
										<input style={input} type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
									</div>
								</div>
								<div>
									<label style={label}>{t('gvAgenda')}</label>
									<textarea style={{ ...input, minHeight: 50 }} value={meetingAgenda} onChange={(e) => setMeetingAgenda(e.target.value)} />
								</div>
								<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
									<button type="button" className={ui.primaryBtn} disabled={busy || !meetingTitle || !meetingDate} onClick={() => void createMeeting()}>{t('gvSave')}</button>
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

					<div style={card}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<div style={{ fontWeight: 700, fontSize: '13px' }}>{t('gvDecisions')}</div>
							{canManage && (
								<button type="button" className={ui.btn} onClick={() => setShowDecision((v) => !v)}>
									<Plus size={13} /> {t('gvNewDecision')}
								</button>
							)}
						</div>
						{showDecision && (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
								<div style={grid}>
									<div>
										<label style={label}>{t('gvMeetingTitle')}</label>
										<input style={input} value={decisionTitle} onChange={(e) => setDecisionTitle(e.target.value)} />
									</div>
									<div>
										<label style={label}>{t('gvType')}</label>
										<select style={input} value={decisionType} onChange={(e) => setDecisionType(e.target.value)}>
											<option value="resolution">Resolution</option>
											<option value="motion">Motion</option>
											<option value="appointment">Appointment</option>
											<option value="budget">Budget</option>
											<option value="minutes">Minutes</option>
										</select>
									</div>
								</div>
								<div>
									<label style={label}>{t('gvContent')}</label>
									<textarea style={{ ...input, minHeight: 70 }} value={decisionContent} onChange={(e) => setDecisionContent(e.target.value)} />
								</div>
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
									<div><label style={label}>{t('gvVotesFor')}</label><input style={input} type="number" min={0} value={votesFor} onChange={(e) => setVotesFor(e.target.value)} /></div>
									<div><label style={label}>{t('gvVotesAgainst')}</label><input style={input} type="number" min={0} value={votesAgainst} onChange={(e) => setVotesAgainst(e.target.value)} /></div>
									<div><label style={label}>{t('gvVotesAbstain')}</label><input style={input} type="number" min={0} value={votesAbstain} onChange={(e) => setVotesAbstain(e.target.value)} /></div>
								</div>
								<label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
									<input type="checkbox" checked={quorumMet} onChange={(e) => setQuorumMet(e.target.checked)} />
									{t('gvQuorumMet')}
								</label>
								<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
									<button type="button" className={ui.primaryBtn} disabled={busy || !decisionTitle || decisionContent.length < 10} onClick={() => void createDecision()}>{t('gvSave')}</button>
								</div>
							</div>
						)}
						<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
							{detail.decisions.length === 0 ? (
								<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoDecisions')}</div>
							) : (
								detail.decisions.map((decision) => (
									<div key={decision.id} style={{ fontSize: '12px', padding: '6px 0', borderTop: '1px solid var(--window-border)' }}>
										<div style={{ display: 'flex', gap: '8px' }}>
											<strong style={{ flex: 1 }}>{decision.kararNo} · {decision.baslik}</strong>
											<span style={{ opacity: 0.6 }}>{formatDate(decision.date)}</span>
										</div>
										<div style={{ opacity: 0.65 }}>
											{decision.decisionType ?? 'resolution'} · {t('gvVotesFor')}: {decision.votesFor ?? 0} · {t('gvVotesAgainst')}: {decision.votesAgainst ?? 0} · {t('gvVotesAbstain')}: {decision.votesAbstain ?? 0}
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			) : tab === 'committees' ? (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '10px', overflowY: 'auto' }}>
					{committees.length === 0 ? (
						<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoCommittees')}</div>
					) : (
						committees.map((committee) => (
							<button
								key={committee.id}
								type="button"
								style={{ ...card, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
								onClick={() => void loadDetail(committee.id)}
							>
								<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
									<Scale size={16} style={{ color: 'var(--accent)' }} />
									<strong style={{ fontSize: '13px' }}>{committee.ad}</strong>
								</div>
								<p style={{ margin: '6px 0', fontSize: '11.5px', opacity: 0.7, minHeight: 30 }}>{committee.aciklama}</p>
								<div style={{ display: 'flex', gap: '10px', fontSize: '10.5px', opacity: 0.65 }}>
									<span><Users size={11} /> {committee.aktifUyeSayisi ?? 0}</span>
									<span>{t('gvQuorum')}: {committee.quorum ?? 0}</span>
								</div>
							</button>
						))
					)}
				</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto' }}>
					{decisions.length === 0 ? (
						<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoDecisions')}</div>
					) : (
						decisions.map((decision) => (
							<div key={decision.id} style={card}>
								<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
									<Vote size={14} style={{ color: 'var(--accent)' }} />
									<strong style={{ fontSize: '12.5px', flex: 1 }}>{decision.kararNo} · {decision.baslik}</strong>
									<span style={{ fontSize: '11px', opacity: 0.6 }}>{formatDate(decision.date)}</span>
								</div>
								<div style={{ fontSize: '11px', opacity: 0.65, marginTop: '4px' }}>
									{decision.bodyAd || '—'} · {decision.decisionType ?? 'resolution'} · {t('gvVotesFor')}: {decision.votesFor ?? 0} / {t('gvVotesAgainst')}: {decision.votesAgainst ?? 0}
								</div>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}
