'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Scale, Vote } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useAppCommand } from '@/core/commands';
import ui from '@/core/ui/ui.module.css';
import { errorMessage } from '@/lib/errors';
import contract from './decisions.contract.json';
import { type Committee, type CommitteeDetail, type Decision, type MemberOption } from './types';
import { CreateCommitteeForm } from './CreateCommitteeForm';
import { CommitteeDetailView } from './CommitteeDetailView';
import { CommitteesGrid } from './CommitteesAndDecisionsLists';
import { DecisionDocuments } from './DecisionDocuments';

export function DecisionsApp() {
	const { t, language } = useI18n();
	const session = useSession();
	const canManage = session.canManageApp('decisions');
	const [tab, setTab] = useState<'committees' | 'decisions'>('decisions');
	const [committees, setCommittees] = useState<Committee[]>([]);
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [members, setMembers] = useState<MemberOption[]>([]);
	const [detail, setDetail] = useState<CommitteeDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState<string | null>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [busy, setBusy] = useState(false);

	const formatDate = (value: number) =>
		new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(value));

	const resolveError = useCallback(
		(data: { errorCode?: string; error?: string } | null) => {
			const entry = data?.errorCode ? contract.errorCodes.find((e) => e.code === data.errorCode) : undefined;
			return entry ? t(entry.i18nKey) : data?.error || t('gvActionFailed');
		},
		[t]
	);

	const load = useCallback(async (silent = false) => {
		if (!silent) setLoading(true);
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

	const loadDetail = useCallback(
		async (id: string) => {
			const res = await fetch(`/api/committees?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
			const data = await res.json().catch(() => null);
			if (res.ok) setDetail(data);
			else setMessage(resolveError(data));
		},
		[resolveError]
	);

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
			if (!res.ok) throw new Error(resolveError(data));
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

	const createCommittee = async (payload: { name: string; description: string; quorum: number; leadId?: string }) => {
		const ok = await post('/api/committees', { action: 'createCommittee', ...payload });
		if (ok) {
			setShowCreate(false);
			setMessage(t('gvCreated'));
		}
		return ok;
	};

	const addMember = async (payload: { userId: string; role: string; votingRight: boolean }) => {
		if (!detail) return false;
		return post('/api/committees', { action: 'addMember', committeeId: detail.committee.id, ...payload });
	};

	const createMeeting = async (payload: { title: string; date: number; agenda: string }) => {
		if (!detail) return false;
		return post('/api/committees', { action: 'createMeeting', committeeId: detail.committee.id, ...payload });
	};

	const createDecision = async (payload: {
		title: string;
		content: string;
		decisionType: string;
		quorumMet: boolean;
		votesFor: number;
		votesAgainst: number;
		votesAbstain: number;
	}) => {
		if (!detail) return false;
		const ok = await post('/api/decisions', { ...payload, agenda: '', bodyId: detail.committee.id });
		if (ok) setMessage(t('gvDecisionCreated'));
		return ok;
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
						<button type="button" className={tab === 'committees' ? ui.primaryBtn : ui.btn} onClick={() => setTab('committees')}>
							<Scale size={14} /> {t('gvCommittees')}
						</button>
						<button type="button" className={tab === 'decisions' ? ui.primaryBtn : ui.btn} onClick={() => setTab('decisions')}>
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
				<div style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '7px', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
					{message}
				</div>
			)}

			{showCreate && (
				<CreateCommitteeForm
					members={members}
					busy={busy}
					onCancel={() => setShowCreate(false)}
					onCreate={createCommittee}
				/>
			)}

			{detail ? (
				<CommitteeDetailView
					detail={detail}
					members={members}
					canManage={canManage}
					busy={busy}
					formatDate={formatDate}
					onAddMember={addMember}
					onCreateMeeting={createMeeting}
					onCreateDecision={createDecision}
				/>
			) : tab === 'committees' ? (
				<CommitteesGrid committees={committees} onOpenCommittee={(id) => void loadDetail(id)} />
			) : (
				<DecisionDocuments
					decisions={decisions}
					canManage={canManage}
					isAdmin={session.isAdmin}
					formatDate={formatDate}
					onChanged={() => load(true)}
				/>
			)}
		</div>
	);
}
