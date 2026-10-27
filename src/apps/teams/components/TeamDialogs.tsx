'use client';

import React, { useState } from 'react';
import { Send, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { Sheet } from '@/core/ui/Sheet';
import {
	BASVURU_NOTU_MAX,
	KONTENJAN_MAX,
	TAKIM_ACIKLAMA_MAX,
	TAKIM_ADI_MAX,
	TAKIM_KATEGORILERI,
	type KatilimTuru,
} from '@/lib/teams';
import ui from '@/core/ui/ui.module.css';
import styles from './Teams.module.css';
import { sendJson } from '@/core/data/http';

/** The note that goes with an application to a team that takes members by approval. */
export function ApplyModal({
	teamName,
	onClose,
	onSend,
}: {
	teamName: string;
	onClose: () => void;
	onSend: (note: string) => Promise<void>;
}) {
	const { t } = useI18n();
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	return (
		<Sheet
			title={t('tmApplyTitle')}
			subtitle={teamName}
			label={t('tmApplyTitle')}
			icon={<Send size={18} color="#0a84ff" />}
			onClose={onClose}
			closeLabel={t('kbClose')}
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				await onSend(note);
				setBusy(false);
			}}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('tmCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{t('tmSendApplication')}
					</button>
				</>
			}
		>
			<div className={ui.hint}>{t('tmApplyHint')}</div>
			<textarea
				className={ui.textarea}
				autoFocus
				rows={5}
				maxLength={BASVURU_NOTU_MAX}
				value={note}
				onChange={(e) => setNote(e.target.value)}
				placeholder={t('tmApplyPh')}
			/>
		</Sheet>
	);
}

export function NewTeamModal({
	roster,
	onClose,
	onCreated,
}: {
	roster: { id: string; ad: string; soyad: string }[];
	onClose: () => void;
	onCreated: () => Promise<void>;
}) {
	const { t } = useI18n();
	const [ad, setAd] = useState('');
	const [kategori, setKategori] = useState<string>(TAKIM_KATEGORILERI[0]);
	const [aciklama, setAciklama] = useState('');
	const [kontenjan, setKontenjan] = useState('6');
	const [repoUrl, setRepoUrl] = useState('');
	const [liderId, setLiderId] = useState('');
	const [katilimTuru, setKatilimTuru] = useState<KatilimTuru>('acik');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		const res = await sendJson('/api/teams', 'POST', {
			action: 'createTeam',
			ad: ad.trim(),
			kategori,
			aciklama: aciklama.trim(),
			kontenjan: Number(kontenjan),
			repoUrl: repoUrl.trim() || undefined,
			liderId: liderId || undefined,
			katilimTuru,
		});
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		await onCreated();
	};

	return (
		<Sheet
			title={t('tmNewTeam')}
			label={t('tmNewTeam')}
			icon={<Users size={20} color="#0a84ff" />}
			onClose={onClose}
			closeLabel={t('kbClose')}
			onSubmit={submit}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('tmCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{t('tmCreate')}
					</button>
				</>
			}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldName')}</span>
				<input
					className={ui.input}
					autoFocus
					required
					minLength={3}
					maxLength={TAKIM_ADI_MAX}
					value={ad}
					onChange={(e) => setAd(e.target.value)}
				/>
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldCategory')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none' }}
						value={kategori}
						onChange={(e) => setKategori(e.target.value)}
					>
						{TAKIM_KATEGORILERI.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldQuota')}</span>
					<input
						className={ui.input}
						type="number"
						min={1}
						max={KONTENJAN_MAX}
						required
						value={kontenjan}
						onChange={(e) => setKontenjan(e.target.value)}
					/>
				</label>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldCaptain')}</span>
				<select
					className={ui.select}
					style={{ maxWidth: 'none' }}
					value={liderId}
					onChange={(e) => setLiderId(e.target.value)}
				>
					<option value="">—</option>
					{roster.map((m) => (
						<option key={m.id} value={m.id}>
							{m.ad} {m.soyad}
						</option>
					))}
				</select>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldRepo')}</span>
				<input
					className={ui.input}
					type="url"
					placeholder="https://github.com/tetha42/…"
					value={repoUrl}
					onChange={(e) => setRepoUrl(e.target.value)}
				/>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldDesc')}</span>
				<textarea
					className={ui.textarea}
					rows={3}
					required
					minLength={10}
					maxLength={TAKIM_ACIKLAMA_MAX}
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
				/>
			</label>
			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldJoin')}</span>
				<div className={styles.radioList} role="radiogroup">
					<label className={styles.radio}>
						<input
							type="radio"
							name="yeni-katilim"
							checked={katilimTuru === 'acik'}
							onChange={() => setKatilimTuru('acik')}
						/>
						{t('tmJoinOpen')}
					</label>
					<label className={styles.radio}>
						<input
							type="radio"
							name="yeni-katilim"
							checked={katilimTuru === 'onayli'}
							onChange={() => setKatilimTuru('onayli')}
						/>
						{t('tmJoinApproval')}
					</label>
				</div>
			</div>
			{error && (
				<div className={ui.error} role="alert">
					{error}
				</div>
			)}
		</Sheet>
	);
}

export function EditTeamModal({
	team,
	roster,
	onClose,
	onSaved,
}: {
	team: import('../types').Team;
	roster: { id: string; ad: string; soyad: string }[];
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const { t } = useI18n();
	const all = team.izinler.editAll;
	const [ad, setAd] = useState(team.ad);
	const [kategori, setKategori] = useState(team.kategori);
	const [aciklama, setAciklama] = useState(team.aciklama);
	const [kontenjan, setKontenjan] = useState(String(team.kontenjan));
	const [repoUrl, setRepoUrl] = useState(team.repoUrl ?? '');
	const [liderId, setLiderId] = useState(team.liderId ?? '');
	const [katilimTuru, setKatilimTuru] = useState<KatilimTuru>(team.katilimTuru);
	const [status, setDurum] = useState(team.status);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		const body: Record<string, unknown> = { action: 'updateTeam', teamId: team.id };
		if (aciklama !== team.aciklama) body.aciklama = aciklama.trim();
		if (Number(kontenjan) !== team.kontenjan) body.kontenjan = Number(kontenjan);
		if (repoUrl !== (team.repoUrl ?? '')) body.repoUrl = repoUrl.trim();
		if (katilimTuru !== team.katilimTuru) body.katilimTuru = katilimTuru;
		if (all) {
			if (ad !== team.ad) body.ad = ad.trim();
			if (kategori !== team.kategori) body.kategori = kategori;
			if (status !== team.status) body.status = status;
			if (liderId !== team.liderId) body.liderId = liderId;
		}
		const res = await sendJson('/api/teams', 'POST', body);
		setBusy(false);
		if (!res.ok) {
			setError(res.error || t('kbActionFailed'));
			return;
		}
		await onSaved();
	};

	const categories = (TAKIM_KATEGORILERI as readonly string[]).includes(team.kategori)
		? TAKIM_KATEGORILERI
		: [team.kategori, ...TAKIM_KATEGORILERI];

	return (
		<Sheet
			title={t('tmSettingsTitle')}
			subtitle={team.ad}
			label={t('tmSettingsTitle')}
			icon={<Users size={20} color="#0a84ff" />}
			onClose={onClose}
			closeLabel={t('kbClose')}
			onSubmit={submit}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('tmCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{t('tmSave')}
					</button>
				</>
			}
		>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldName')}</span>
				<input
					className={ui.input}
					disabled={!all}
					required
					minLength={3}
					maxLength={TAKIM_ADI_MAX}
					value={ad}
					onChange={(e) => setAd(e.target.value)}
				/>
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldCategory')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none' }}
						disabled={!all}
						value={kategori}
						onChange={(e) => setKategori(e.target.value)}
					>
						{categories.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('tmFieldQuota')}</span>
					<input
						className={ui.input}
						type="number"
						min={Math.max(1, team.doluKontenjan)}
						max={KONTENJAN_MAX}
						required
						value={kontenjan}
						onChange={(e) => setKontenjan(e.target.value)}
					/>
				</label>
			</div>
			{all && (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldStatus')}</span>
						<select
							className={ui.select}
							style={{ maxWidth: 'none' }}
							value={status}
							onChange={(e) => setDurum(e.target.value as typeof team.status)}
						>
							<option value="aktif">{t('tmStatusActive')}</option>
							<option value="askida">{t('tmStatusPaused')}</option>
							<option value="tamamlandi">{t('tmStatusFinished')}</option>
						</select>
					</label>
					<label className={ui.field}>
						<span className={ui.fieldLabel}>{t('tmFieldCaptain')}</span>
						<select
							className={ui.select}
							style={{ maxWidth: 'none' }}
							value={liderId}
							onChange={(e) => setLiderId(e.target.value)}
						>
							<option value="">—</option>
							{roster.map((m) => (
								<option key={m.id} value={m.id}>
									{m.ad} {m.soyad}
								</option>
							))}
						</select>
					</label>
				</div>
			)}
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldRepo')}</span>
				<input
					className={ui.input}
					type="url"
					placeholder="https://github.com/tetha42/…"
					value={repoUrl}
					onChange={(e) => setRepoUrl(e.target.value)}
				/>
			</label>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldDesc')}</span>
				<textarea
					className={ui.textarea}
					rows={3}
					required
					minLength={10}
					maxLength={TAKIM_ACIKLAMA_MAX}
					value={aciklama}
					onChange={(e) => setAciklama(e.target.value)}
				/>
			</label>
			<div className={ui.field}>
				<span className={ui.fieldLabel}>{t('tmFieldJoin')}</span>
				<div className={styles.radioList} role="radiogroup">
					<label className={styles.radio}>
						<input
							type="radio"
							name="duzenle-katilim"
							checked={katilimTuru === 'acik'}
							onChange={() => setKatilimTuru('acik')}
						/>
						{t('tmJoinOpen')}
					</label>
					<label className={styles.radio}>
						<input
							type="radio"
							name="duzenle-katilim"
							checked={katilimTuru === 'onayli'}
							onChange={() => setKatilimTuru('onayli')}
						/>
						{t('tmJoinApproval')}
					</label>
				</div>
			</div>
			{error && (
				<div className={ui.error} role="alert">
					{error}
				</div>
			)}
		</Sheet>
	);
}
