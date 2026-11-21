'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from '../SettingsMobile.module.css';

interface SettingsMobileProfileCardProps {
	profilePhoto?: string | null;
	fullName: string;
	userInitials: string;
	department?: string | null;
	grade?: number | null;
	email?: string | null;
	onOpenAccount: () => void;
}

export function SettingsMobileProfileCard({
	profilePhoto,
	fullName,
	userInitials,
	department,
	grade,
	email,
	onOpenAccount,
}: SettingsMobileProfileCardProps) {
	const { t } = useI18n();

	return (
		<button type="button" className={s.profileCard} onClick={onOpenAccount}>
			<div className={s.profileAvatarWrap}>
				{profilePhoto ? (
					/* eslint-disable-next-line @next/next/no-img-element */
					<img src={profilePhoto} alt={fullName} className={s.profileAvatarImg} />
				) : (
					<div className={s.profileAvatarInitials}>{userInitials}</div>
				)}
			</div>

			<div className={s.profileInfo}>
				<div className={s.profileName}>{fullName}</div>
				<div className={s.profileSubtitle}>
					{department
						? `${department}${grade ? ` • ${fill(t('membersClassYear'), { year: grade })}` : ''}`
						: email || t('settingsProfileCardFallback')}
				</div>
			</div>

			<ChevronRight size={18} color="#8e8e93" style={{ opacity: 0.6 }} />
		</button>
	);
}
