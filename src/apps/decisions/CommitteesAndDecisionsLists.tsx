'use client';

import { Scale, Users, Vote } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { cardStyle, type Committee, type Decision } from './types';

export function CommitteesGrid({
	committees,
	onOpenCommittee,
}: {
	committees: Committee[];
	onOpenCommittee: (id: string) => void;
}) {
	const { t } = useI18n();
	if (committees.length === 0) {
		return <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoCommittees')}</div>;
	}
	return (
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '10px', overflowY: 'auto' }}>
			{committees.map((committee) => (
				<button
					key={committee.id}
					type="button"
					style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
					onClick={() => onOpenCommittee(committee.id)}
				>
					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
						<Scale size={16} style={{ color: 'var(--accent)' }} />
						<strong style={{ fontSize: '13px' }}>{committee.name}</strong>
					</div>
					<p style={{ margin: '6px 0', fontSize: '11.5px', opacity: 0.7, minHeight: 30 }}>{committee.description}</p>
					<div style={{ display: 'flex', gap: '10px', fontSize: '10.5px', opacity: 0.65 }}>
						<span>
							<Users size={11} /> {committee.activeMemberCount ?? 0}
						</span>
						<span>
							{t('gvQuorum')}: {committee.quorum ?? 0}
						</span>
					</div>
				</button>
			))}
		</div>
	);
}

export function DecisionsArchiveList({
	decisions,
	formatDate,
}: {
	decisions: Decision[];
	formatDate: (ts: number) => string;
}) {
	const { t } = useI18n();
	if (decisions.length === 0) {
		return <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoDecisions')}</div>;
	}
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto' }}>
			{decisions.map((decision) => (
				<div key={decision.id} style={cardStyle}>
					<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
						<Vote size={14} style={{ color: 'var(--accent)' }} />
						<strong style={{ fontSize: '12.5px', flex: 1 }}>
							{decision.referenceNumber} · {decision.title}
						</strong>
						<span style={{ fontSize: '11px', opacity: 0.6 }}>{formatDate(decision.date)}</span>
					</div>
					<div style={{ fontSize: '11px', opacity: 0.65, marginTop: '4px' }}>
						{decision.bodyName || '—'} · {decision.decisionType ?? 'resolution'} · {t('gvVotesFor')}:{' '}
						{decision.votesFor ?? 0} / {t('gvVotesAgainst')}: {decision.votesAgainst ?? 0}
					</div>
				</div>
			))}
		</div>
	);
}
