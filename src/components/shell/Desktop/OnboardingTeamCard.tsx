'use client';

import { Check, Clock, Send, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { APPLICATION_NOTE_MAX, EXPERTISE_SUGGESTIONS } from '@/lib/teams';
import type { TeamShowcaseRecord } from '@/db/repositories/teams.repo';
import ui from '@/core/ui/ui.module.css';

interface OnboardingTeamCardProps {
	team: TeamShowcaseRecord;
	compact: boolean;
	readOnly: boolean;
	atLimit: boolean;
	teamLimit: number;
	busy: boolean;
	formOpen: boolean;
	skills: string[];
	note: string;
	formError: string | null;
	onOpenForm: (teamId: string) => void;
	onCloseForm: () => void;
	onToggleSkill: (skill: string) => void;
	onNoteChange: (note: string) => void;
	onSubmitAction: (body: Record<string, unknown>, done?: () => void) => void;
}

export function OnboardingTeamCard({
	team,
	compact,
	readOnly,
	atLimit,
	teamLimit,
	busy,
	formOpen,
	skills,
	note,
	formError,
	onOpenForm,
	onCloseForm,
	onToggleSkill,
	onNoteChange,
	onSubmitAction,
}: OnboardingTeamCardProps) {
	const { t } = useI18n();
	const full = team.remainingCapacity === 0;

	return (
		<li
			data-team-id={team.id}
			style={{
				padding: '12px',
				borderRadius: '12px',
				border: '1px solid var(--window-border)',
				background: 'var(--fill-softer, rgba(127, 127, 127, 0.08))',
			}}
		>
			<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
				<div style={{ minWidth: 0 }}>
					<div style={{ fontSize: '13.5px', fontWeight: 700 }}>{team.name}</div>
					<div style={{ fontSize: '11.5px', opacity: 0.7 }}>
						{team.category}
						{team.leaderName ? ` · ${t('tmCaptain')}: ${team.leaderName}` : ''}
					</div>
				</div>
				<div style={{ fontSize: '11.5px', opacity: 0.75, whiteSpace: 'nowrap', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
					<Users size={12} aria-hidden="true" />
					{fill(t('obSeats'), { free: team.remainingCapacity, total: team.capacity })}
				</div>
			</div>
			<p
				style={{
					margin: '6px 0 8px',
					fontSize: '12px',
					lineHeight: 1.45,
					opacity: 0.8,
					display: '-webkit-box',
					WebkitLineClamp: compact ? 3 : 2,
					WebkitBoxOrient: 'vertical',
					overflow: 'hidden',
				}}
			>
				{team.description}
			</p>

			{team.myStatus === 'active' ? (
				<div style={{ fontSize: '12px', color: 'var(--success)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
					<Check size={13} aria-hidden="true" /> {team.myDecision === 'accepted' ? t('obAccepted') : t('tmMember')}
				</div>
			) : team.myStatus === 'applied' ? (
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
					<span style={{ fontSize: '12px', color: 'var(--warning)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
						<Clock size={13} aria-hidden="true" /> {t('obApplied')}
					</span>
					{!readOnly && (
						<button type="button" className={ui.btn} disabled={busy} onClick={() => onSubmitAction({ action: 'withdraw', teamId: team.id })}>
							{t('tmWithdraw')}
						</button>
					)}
				</div>
			) : formOpen ? (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						onSubmitAction({ action: 'apply', teamId: team.id, expertise: skills, applicationNote: note }, onCloseForm);
					}}
					style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
				>
					<div style={{ fontSize: '11.5px', fontWeight: 600 }}>{t('obSkills')}</div>
					<div role="group" aria-label={t('obSkills')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
						{EXPERTISE_SUGGESTIONS.map((skill) => {
							const on = skills.includes(skill);
							return (
								<button
									key={skill}
									type="button"
									aria-pressed={on}
									onClick={() => onToggleSkill(skill)}
									style={{
										padding: '4px 10px',
										borderRadius: 999,
										fontSize: '11.5px',
										cursor: 'pointer',
										border: `1px solid ${on ? 'var(--accent-blue)' : 'var(--window-border)'}`,
										background: on ? 'var(--accent-blue)' : 'transparent',
										color: on ? '#fff' : 'inherit',
									}}
								>
									{skill}
								</button>
							);
						})}
					</div>
					<label style={{ fontSize: '11.5px', fontWeight: 600 }}>
						{t('obNote')}
						<textarea
							value={note}
							maxLength={APPLICATION_NOTE_MAX}
							rows={3}
							placeholder={t('obNotePh')}
							onChange={(e) => onNoteChange(e.target.value)}
							style={{
								display: 'block',
								width: '100%',
								boxSizing: 'border-box',
								marginTop: 4,
								padding: '8px',
								borderRadius: 8,
								border: '1px solid var(--window-border)',
								background: 'transparent',
								color: 'inherit',
								font: 'inherit',
								fontWeight: 400,
								resize: 'vertical',
							}}
						/>
					</label>
					{formError && (
						<div role="alert" style={{ fontSize: '12px', color: 'var(--danger)' }}>
							{formError}
						</div>
					)}
					<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
						<button type="button" className={ui.btn} disabled={busy} onClick={onCloseForm}>
							{t('obCancel')}
						</button>
						<button type="submit" className={ui.primaryBtn} disabled={busy}>
							<Send size={13} /> {busy ? t('obSending') : t('tmSendApplication')}
						</button>
					</div>
				</form>
			) : (
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
					<span style={{ fontSize: '12px', opacity: 0.85, color: team.myDecision === 'rejected' ? 'var(--warning)' : undefined }}>
						{team.myDecision === 'rejected' ? t('obRejected') : ''}
					</span>
					<button
						type="button"
						className={ui.primaryBtn}
						disabled={busy || readOnly || full || atLimit}
						title={atLimit ? fill(t('tmLimitReached'), { n: teamLimit }) : undefined}
						onClick={() => onOpenForm(team.id)}
					>
						{full ? t('tmFull') : t('tmApply')}
					</button>
				</div>
			)}
		</li>
	);
}
