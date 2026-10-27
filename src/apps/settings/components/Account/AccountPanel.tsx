'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { fill } from '@/lib/text';
import { BIO_MAX, SINIF_MAX, SINIF_MIN } from '@/lib/profile';
import { DEPARTMENTS } from '@/data/departments';
import type { UserSummary } from '@/db';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import styles from './Account.module.css';
import { AccountProfileHero } from './AccountProfileHero';
import { AccountStatsCards } from './AccountStatsCards';
import { AccountPasswordForm } from './AccountPasswordForm';

interface ProfileResponse {
	user: {
		id: string;
		ad: string;
		soyad: string;
		email: string;
		ogrenciNo: string | null;
		bolum: string;
		sinif: number;
		rolBilgi: { id: string; ad: string; renk: string } | null;
		profilFoto?: string | null;
		bio?: string | null;
		xp: number;
		olusturma: number;
	};
	seviye: { seviye: number; ilerleme: number; sonraki: number };
	ozet: UserSummary;
}

export function AccountPanel() {
	const { refreshSession } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const { data, refetch } = useJsonResource<ProfileResponse>('/api/profile');

	const [bolum, setBolum] = useState<string | null>(null);
	const [sinif, setSinif] = useState<number | null>(null);
	const [bio, setBio] = useState<string | null>(null);
	const [busy, setBusy] = useState<'' | 'profile' | 'photo' | 'password'>('');
	const [msg, setMsg] = useState<{ area: 'profile' | 'photo' | 'password'; text: string; tone: 'ok' | 'err' } | null>(null);

	useEffect(() => {
		if (!msg || msg.tone === 'err') return;
		const id = setTimeout(() => setMsg(null), 3500);
		return () => clearTimeout(id);
	}, [msg]);

	if (!data) return <div className={ui.muted}>…</div>;
	const { user, seviye, ozet } = data;
	const values = { bolum: bolum ?? user.bolum, sinif: sinif ?? user.sinif, bio: bio ?? user.bio ?? '' };
	const dirty = values.bolum !== user.bolum || values.sinif !== user.sinif || values.bio !== (user.bio ?? '');
	const departments = DEPARTMENTS.some((d) => d.name === user.bolum) ? DEPARTMENTS.map((d) => d.name) : [user.bolum, ...DEPARTMENTS.map((d) => d.name)];

	const done = async (area: 'profile' | 'photo' | 'password', ok: boolean, text: string) => {
		setBusy('');
		setMsg({ area, text, tone: ok ? 'ok' : 'err' });
		if (ok) {
			playSystemSound();
			await Promise.all([refetch(), refreshSession()]);
		}
	};

	const saveProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy('profile');
		const res = await sendJson('/api/profile', 'PATCH', values);
		if (res.ok) {
			setBolum(null);
			setSinif(null);
			setBio(null);
		}
		await done('profile', res.ok, res.ok ? t('acSaved') : res.error || t('kbActionFailed'));
	};

	const note = (area: 'profile' | 'photo' | 'password') =>
		msg?.area === area ? (
			<div className={msg.tone === 'ok' ? styles.ok : ui.error} role={msg.tone === 'ok' ? 'status' : 'alert'}>
				{msg.text}
			</div>
		) : null;

	return (
		<div className={styles.root} data-focus-section="account">
			<AccountProfileHero
				user={user}
				seviye={seviye}
				busy={busy}
				onPhotoDone={(ok, text) => done('photo', ok, text)}
				onSetBusy={setBusy}
				note={note('photo')}
			/>

			<AccountStatsCards ozet={ozet} />

			<form className={styles.card} onSubmit={saveProfile} aria-label={t('acProfile')}>
				<h4 className={styles.cardTitle}>{t('acProfile')}</h4>
				<div className={styles.grid2}>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acEmail')}</span>
						<input className={ui.input} value={user.email} disabled />
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acStudentNo')}</span>
						<input className={ui.input} value={user.ogrenciNo ?? '—'} disabled />
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acDepartment')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={values.bolum} onChange={(e) => setBolum(e.target.value)}>
							{departments.map((d) => (
								<option key={d} value={d}>
									{d}
								</option>
							))}
						</select>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('acYear')}</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={values.sinif} onChange={(e) => setSinif(Number(e.target.value))}>
							{Array.from({ length: SINIF_MAX - SINIF_MIN + 1 }, (_, i) => i + SINIF_MIN).map((n) => (
								<option key={n} value={n}>
									{fill(t('acYearN'), { n })}
								</option>
							))}
						</select>
					</label>
				</div>
				<label className={ui.field}>
					<span className={ui.fieldLabel} style={{ display: 'flex' }}>
						{t('acBio')}
						<span style={{ marginLeft: 'auto', fontWeight: 500 }}>
							{values.bio.length}/{BIO_MAX}
						</span>
					</span>
					<textarea className={ui.textarea} rows={3} maxLength={BIO_MAX} value={values.bio} placeholder={t('acBioPh')} onChange={(e) => setBio(e.target.value)} />
				</label>
				<div className={ui.btnRow} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
					<span className={ui.hint}>{t('acIdentityHint')}</span>
					<button type="submit" className={ui.primaryBtn} disabled={!dirty || busy === 'profile'}>
						{t('acSave')}
					</button>
				</div>
				{note('profile')}
			</form>

			<AccountPasswordForm
				userEmail={user.email}
				busy={busy}
				onPasswordDone={(ok, text) => done('password', ok, text)}
				onSetBusy={setBusy}
				note={note('password')}
			/>
		</div>
	);
}
