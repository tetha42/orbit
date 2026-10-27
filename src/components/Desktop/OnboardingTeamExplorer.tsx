'use client';

import { useState } from 'react';
import { Check, Clock, Send, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useLiveEvent } from '@/core/session';
import { useJsonResource } from '@/core/data/useJsonResource';
import { errorMessage } from '@/lib/errors';
import { fill } from '@/lib/text';
import { BASVURU_NOTU_MAX, UZMANLIK_ONERILERI } from '@/lib/teams';
import type { TeamShowcaseRecord } from '@/server/db/domains/teams.repo';
import ui from '@/core/ui/ui.module.css';

interface ShowcaseResponse {
	takimlar: TeamShowcaseRecord[];
	benimTakimSayim: number;
	limitler: { takim: number; bekleyenBasvuru: number };
	saltOkunur: boolean;
}

async function post(body: Record<string, unknown>): Promise<void> {
	const res = await fetch('/api/teams/discover', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (res.ok) return;
	const data = (await res.json().catch(() => null)) as { error?: string } | null;
	throw new Error(data?.error || 'İşlem tamamlanamadı.');
}

/**
 * Welcome card for a member who has no role (and so no Teams app) yet: the club's
 * teams that are taking members, each with a one-tap application where the member
 * ticks what they can do and leaves the captain a note. It reads and writes only
 * `/api/teams/discover`, which any signed-in member may use; applications there
 * are always reviewed by the captain.
 *
 * The list re-reads itself when the captain answers (live `takim_guncellendi` /
 * `bildirim` events), so "waiting" turns into "accepted" without a reload.
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
		if (event === 'takim_guncellendi' || event === 'bildirim') void refetch();
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
			{data.saltOkunur && <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: 8 }}>{t('obReadOnly')}</div>}
			{formError && formFor === null && (
				<div role="alert" style={{ fontSize: '12px', color: '#ff453a', marginBottom: 8 }}>
					{formError}
				</div>
			)}

			{data.takimlar.length === 0 ? (
				<div style={state}>{t('obEmpty')}</div>
			) : (
				<ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
					{data.takimlar.map((team) => {
						const full = team.kalanKontenjan === 0;
						const atLimit = data.benimTakimSayim >= data.limitler.takim;
						const formOpen = formFor === team.id;
						return (
							<li
								key={team.id}
								data-team-id={team.id}
								style={{
									padding: '12px',
									borderRadius: '12px',
									border: '1px solid var(--window-border)',
									background: 'rgba(127, 127, 127, 0.08)',
								}}
							>
								<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
									<div style={{ minWidth: 0 }}>
										<div style={{ fontSize: '13.5px', fontWeight: 700 }}>{team.ad}</div>
										<div style={{ fontSize: '11.5px', opacity: 0.7 }}>
											{team.kategori}
											{team.liderAdSoyad ? ` · ${t('tmCaptain')}: ${team.liderAdSoyad}` : ''}
										</div>
									</div>
									<div style={{ fontSize: '11.5px', opacity: 0.75, whiteSpace: 'nowrap', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
										<Users size={12} aria-hidden="true" />
										{fill(t('obSeats'), { free: team.kalanKontenjan, total: team.kontenjan })}
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
									{team.aciklama}
								</p>

								{team.benimDurumum === 'aktif' ? (
									<div style={{ fontSize: '12px', color: '#30d158', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
										<Check size={13} aria-hidden="true" /> {team.benimKararim === 'kabul' ? t('obAccepted') : t('tmMember')}
									</div>
								) : team.benimDurumum === 'basvurdu' ? (
									<div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
										<span style={{ fontSize: '12px', color: '#ff9f0a', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
											<Clock size={13} aria-hidden="true" /> {t('obApplied')}
										</span>
										{!data.saltOkunur && (
											<button type="button" className={ui.btn} disabled={busy} onClick={() => void run({ action: 'withdraw', teamId: team.id })}>
												{t('tmWithdraw')}
											</button>
										)}
									</div>
								) : formOpen ? (
									<form
										onSubmit={(e) => {
											e.preventDefault();
											void run({ action: 'apply', teamId: team.id, uzmanliklar: skills, basvuruNotu: note }, () => setFormFor(null));
										}}
										style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
									>
										<div style={{ fontSize: '11.5px', fontWeight: 600 }}>{t('obSkills')}</div>
										<div role="group" aria-label={t('obSkills')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
											{UZMANLIK_ONERILERI.map((skill) => {
												const on = skills.includes(skill);
												return (
													<button
														key={skill}
														type="button"
														aria-pressed={on}
														onClick={() => toggleSkill(skill)}
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
												maxLength={BASVURU_NOTU_MAX}
												rows={3}
												placeholder={t('obNotePh')}
												onChange={(e) => setNote(e.target.value)}
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
											<div role="alert" style={{ fontSize: '12px', color: '#ff453a' }}>
												{formError}
											</div>
										)}
										<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
											<button type="button" className={ui.btn} disabled={busy} onClick={() => setFormFor(null)}>
												{t('obCancel')}
											</button>
											<button type="submit" className={ui.primaryBtn} disabled={busy}>
												<Send size={13} /> {busy ? t('obSending') : t('tmSendApplication')}
											</button>
										</div>
									</form>
								) : (
									<div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
										<span style={{ fontSize: '12px', opacity: 0.85, color: team.benimKararim === 'red' ? '#ff9f0a' : undefined }}>
											{team.benimKararim === 'red' ? t('obRejected') : ''}
										</span>
										<button
											type="button"
											className={ui.primaryBtn}
											disabled={busy || data.saltOkunur || full || atLimit}
											title={atLimit ? fill(t('tmLimitReached'), { n: data.limitler.takim }) : undefined}
											onClick={() => openForm(team.id)}
										>
											{full ? t('tmFull') : t('tmApply')}
										</button>
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
