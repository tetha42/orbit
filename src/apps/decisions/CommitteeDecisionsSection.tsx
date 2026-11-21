'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import contract from './decisions.contract.json';
import { cardStyle, gridStyle, inputStyle, labelStyle, type Decision } from './types';

const DECISION_TYPE_KEYS: Record<string, string> = {
	resolution: 'gvTypeResolution',
	motion: 'gvTypeMotion',
	appointment: 'gvTypeAppointment',
	budget: 'gvTypeBudget',
	minutes: 'gvTypeMinutes',
};

interface CommitteeDecisionsSectionProps {
	decisions: Decision[];
	canManage: boolean;
	busy: boolean;
	formatDate: (value: number) => string;
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

export function CommitteeDecisionsSection({
	decisions,
	canManage,
	busy,
	formatDate,
	onCreateDecision,
}: CommitteeDecisionsSectionProps) {
	const { t } = useI18n();
	const [showDecision, setShowDecision] = useState(false);
	const [decisionTitle, setDecisionTitle] = useState('');
	const [decisionContent, setDecisionContent] = useState('');
	const [decisionType, setDecisionType] = useState('resolution');
	const [votesFor, setVotesFor] = useState('0');
	const [votesAgainst, setVotesAgainst] = useState('0');
	const [votesAbstain, setVotesAbstain] = useState('0');
	const [quorumMet, setQuorumMet] = useState(true);

	const handleSubmit = async () => {
		const ok = await onCreateDecision({
			title: decisionTitle.slice(0, contract.limits.maxTitleLength),
			content: decisionContent.slice(0, contract.limits.maxContentLength),
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
		}
	};

	return (
		<div style={cardStyle}>
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
					<div style={gridStyle}>
						<div>
							<label style={labelStyle}>{t('gvMeetingTitle')}</label>
							<input
								style={inputStyle}
								maxLength={contract.limits.maxTitleLength}
								value={decisionTitle}
								onChange={(e) => setDecisionTitle(e.target.value)}
							/>
						</div>
						<div>
							<label style={labelStyle}>{t('gvType')}</label>
							<select style={inputStyle} value={decisionType} onChange={(e) => setDecisionType(e.target.value)}>
								<option value="resolution">{t('gvTypeResolution')}</option>
								<option value="motion">{t('gvTypeMotion')}</option>
								<option value="appointment">{t('gvTypeAppointment')}</option>
								<option value="budget">{t('gvTypeBudget')}</option>
								<option value="minutes">{t('gvTypeMinutes')}</option>
							</select>
						</div>
					</div>
					<div>
						<label style={labelStyle}>{t('gvContent')}</label>
						<textarea
							style={{ ...inputStyle, minHeight: 70 }}
							maxLength={contract.limits.maxContentLength}
							value={decisionContent}
							onChange={(e) => setDecisionContent(e.target.value)}
						/>
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
						<div>
							<label style={labelStyle}>{t('gvVotesFor')}</label>
							<input style={inputStyle} type="number" min={0} value={votesFor} onChange={(e) => setVotesFor(e.target.value)} />
						</div>
						<div>
							<label style={labelStyle}>{t('gvVotesAgainst')}</label>
							<input style={inputStyle} type="number" min={0} value={votesAgainst} onChange={(e) => setVotesAgainst(e.target.value)} />
						</div>
						<div>
							<label style={labelStyle}>{t('gvVotesAbstain')}</label>
							<input style={inputStyle} type="number" min={0} value={votesAbstain} onChange={(e) => setVotesAbstain(e.target.value)} />
						</div>
					</div>
					<label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
						<input type="checkbox" checked={quorumMet} onChange={(e) => setQuorumMet(e.target.checked)} />
						{t('gvQuorumMet')}
					</label>
					<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
						<button
							type="button"
							className={ui.primaryBtn}
							disabled={busy || !decisionTitle || decisionContent.length < 10}
							onClick={() => void handleSubmit()}
						>
							{t('gvSave')}
						</button>
					</div>
				</div>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
				{decisions.length === 0 ? (
					<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('gvNoDecisions')}</div>
				) : (
					decisions.map((decision) => (
						<div key={decision.id} style={{ fontSize: '12px', padding: '6px 0', borderTop: '1px solid var(--window-border)' }}>
							<div style={{ display: 'flex', gap: '8px' }}>
								<strong style={{ flex: 1 }}>
									{decision.referenceNumber} · {decision.title}
								</strong>
								<span style={{ opacity: 0.6 }}>{formatDate(decision.date)}</span>
							</div>
							<div style={{ opacity: 0.65 }}>
								{t(DECISION_TYPE_KEYS[decision.decisionType ?? 'resolution'] ?? 'gvTypeResolution')} · {t('gvVotesFor')}: {decision.votesFor ?? 0} ·{' '}
								{t('gvVotesAgainst')}: {decision.votesAgainst ?? 0} · {t('gvVotesAbstain')}: {decision.votesAbstain ?? 0}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
