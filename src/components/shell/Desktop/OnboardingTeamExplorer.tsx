'use client';

import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useLiveEvent } from '@/core/session';
import { useJsonResource } from '@/core/data/useJsonResource';
import { errorMessage } from '@/lib/errors';
import type { TeamShowcaseRecord } from '@/db/repositories/teams.repo';
import { OnboardingTeamCard } from './OnboardingTeamCard';

interface ShowcaseResponse {
	teams: TeamShowcaseRecord[];
	myTeamCount: number;
	limits: { team: number; pendingApplication: number };
	readOnly: boolean;
}

async function post(body: Record<string, unknown>): Promise<void> {
	const res = await fetch('/api/teams/discover', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (res.ok) return;
	const data = (await res.json().catch(() => null)) as { error?: string } | null;
	throw new Error(data?.error || 'Operation failed.');
}

/**
 * Welcome card for a member who has no role (and so no Teams app) yet: the club's
 * teams that are taking members, each with a one-tap application where the member
 * ticks what they can do and leaves the captain a note. It reads and writes only
 * `/api/teams/discover`, which any signed-in member may use; applications there
 * are always reviewed by the captain.
 *
 * The list re-reads itself when the captain answers (live `team_updated` /
 * `notification` events), so "waiting" turns into "accepted" without a reload.
 */
export function OnboardingTeamExplorer({ compact = false }: { compact?: boolean }) {
	const { t } = useI18n();
	const { data, error, isLoading, refetch } = useJsonResource<ShowcaseResponse>('/api/teams/discover');
	const [formFor, setFormFor] = useState<string | null>(null);
	const [skills, setSkills] = useState<string[]>([]);
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	useLiveEvent((event) => {
		if (event === 'team_updated' || event === 'notification') void refetch();
	});

	const openForm = (id: string) => {
		setFormFor(id);
		setSkills([]);
		setNote('');
		setFormError(null);
	};
	const toggleSkill = (skill: string) =>
		setSkills((current) => (current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill]));

	const run = async (body: Record<string, unknown>, done?: () => void) => {
		setBusy(true);
		setFormError(null);
		try {
			await post(body);
			done?.();
			await refetch();
		} catch (err) {
			setFormError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	const state = { padding: '10px 0', fontSize: '12.5px', opacity: 0.7, textAlign: 'center' } as const;
	if (isLoading) return <div style={state}>{t('obLoading')}</div>;
	if (!data) return <div style={state}>{error || t('obLoadFailed')}</div>;

	return (
		<section aria-label={t('obTitle')} data-onboarding-teams style={{ width: '100%', textAlign: 'left' }}>
			<div style={{ fontSize: '13.5px', fontWeight: 700 }}>{t('obTitle')}</div>
			<div style={{ fontSize: '12px', opacity: 0.7, margin: '2px 0 10px' }}>{t('obSubtitle')}</div>
			{data.readOnly && <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: 8 }}>{t('obReadOnly')}</div>}
			{formError && formFor === null && (
				<div role="alert" style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: 8 }}>
					{formError}
				</div>
			)}

			{data.teams.length === 0 ? (
				<div style={state}>{t('obEmpty')}</div>
			) : (
				<ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
					{data.teams.map((team) => (
						<OnboardingTeamCard
							key={team.id}
							team={team}
							compact={compact}
							readOnly={data.readOnly}
							atLimit={data.myTeamCount >= data.limits.team}
							teamLimit={data.limits.team}
							busy={busy}
							formOpen={formFor === team.id}
							skills={skills}
							note={note}
							formError={formError}
							onOpenForm={openForm}
							onCloseForm={() => setFormFor(null)}
							onToggleSkill={toggleSkill}
							onNoteChange={setNote}
							onSubmitAction={(body, done) => void run(body, done)}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
