'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { Camera, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { PROFILE_PHOTO_PX } from '@/lib/profile';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { initials } from '@/core/text/initials';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';

interface AccountProfileHeroProps {
	user: {
		id: string;
		firstName?: string;
		lastName?: string;
		avatarUrl?: string | null;
		createdAt?: number;
		name: string;
		surname: string;
		email: string;
		roleInfo: { id: string; name: string; color: string } | null;
		profilePhoto?: string | null;
		xp: number;
		creation: number;
	};
	level: { level: number; progress: number; next: number };
	busy: string;
	onPhotoDone: (ok: boolean, text: string) => void;
	onSetBusy: (busy: '' | 'photo') => void;
	note?: React.ReactNode;
}

async function squareImage(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const side = Math.min(bitmap.width, bitmap.height);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = PROFILE_PHOTO_PX;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas');
	ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PROFILE_PHOTO_PX, PROFILE_PHOTO_PX);
	const blob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
	const webp = await blob('image/webp');
	if (webp && webp.type === 'image/webp') return webp;
	const jpeg = await blob('image/jpeg');
	if (!jpeg) throw new Error('encode');
	return jpeg;
}

export function AccountProfileHero({
	user,
	level,
	busy,
	onPhotoDone,
	onSetBusy,
	note,
}: AccountProfileHeroProps) {
	const { t, language } = useI18n();
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';
	const fileRef = useRef<HTMLInputElement>(null);

	const pickPhoto = async (file: File | undefined) => {
		if (!file) return;
		onSetBusy('photo');
		try {
			const blob = await squareImage(file);
			const form = new FormData();
			form.append('file', blob, blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg');
			const res = await fetch('/api/profilee/photo', { method: 'POST', body: form });
			const body = await res.json().catch(() => ({}));
			onPhotoDone(res.ok, res.ok ? t('acPhotoSaved') : body.error || t('kbActionFailed'));
		} catch {
			onPhotoDone(false, t('kbActionFailed'));
		}
		if (fileRef.current) fileRef.current.value = '';
	};

	const removePhoto = async () => {
		onSetBusy('photo');
		const res = await fetch('/api/profilee/photo', { method: 'DELETE' });
		onPhotoDone(res.ok, res.ok ? t('acPhotoRemoved') : t('kbActionFailed'));
	};

	return (
		<section className={styles.hero}>
			<div className={styles.avatarWrap}>
				{user.avatarUrl || user.profilePhoto ? (
					<Image src={(user.avatarUrl || user.profilePhoto)!} alt="" width={96} height={96} unoptimized className={styles.avatar} />
				) : (
					<span className={`${styles.avatar} ${styles.avatarInitials}`}>{initials(`${user.firstName || user.name || ''} ${user.lastName || user.surname || ''}`)}</span>
				)}
				<button
					type="button"
					className={styles.avatarBtn}
					onClick={() => fileRef.current?.click()}
					disabled={busy === 'photo'}
					aria-label={t('acChangePhoto')}
					title={t('acChangePhoto')}
				>
					<Camera size={15} />
				</button>
				<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
			</div>
			<div className={styles.heroBody}>
				<h3 className={styles.name}>
					{user.firstName || user.name} {user.lastName || user.surname}
				</h3>
				<div className={styles.meta}>
					<RoleBadge role={user.roleInfo} emptyText={t('roleNone')} />{' '}
					{user.email} · {fill(t('acMemberSince'), { date: new Date(user.createdAt || user.creation || 0).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) })}
				</div>
				<div className={styles.level}>
					<strong>{fill(t('acLevel'), { n: level.level })}</strong>
					<div className={styles.levelTrack} aria-hidden>
						<span style={{ width: `${Math.round(level.progress * 100)}%` }} />
					</div>
					<span className={ui.muted}>
						{user.xp} XP · {fill(t('acXpToNext'), { n: level.next - user.xp })}
					</span>
				</div>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
					<button type="button" className={ui.btn} onClick={() => fileRef.current?.click()} disabled={busy === 'photo'}>
						<Camera size={14} /> {t('acChangePhoto')}
					</button>
					{user.profilePhoto && (
						<button type="button" className={`${ui.btn} ${ui.btnDanger}`} onClick={removePhoto} disabled={busy === 'photo'}>
							<Trash2 size={14} /> {t('acRemovePhoto')}
						</button>
					)}
					<span className={ui.hint}>{t('acPhotoHint')}</span>
				</div>
				{note}
			</div>
		</section>
	);
}
