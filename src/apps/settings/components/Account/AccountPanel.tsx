'use client';

import React from 'react';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';
import { AccountProfileHero } from './AccountProfileHero';
import { AccountStatsCards } from './AccountStatsCards';
import { AccountPasswordForm } from './AccountPasswordForm';
import { AccountProfileForm } from './AccountProfileForm';
import { AccountStorageCard } from './AccountStorageCard';
import { AccountLegalConsents } from './AccountLegalConsents';
import { useAccountPanel } from './useAccountPanel';

export function AccountPanel() {
	const account = useAccountPanel();
	const { data, msg } = account;

	if (!data) return <div className={ui.muted}>…</div>;

	const { user, level, summary } = data;
	const selfFields = data.fields ?? [];
	const values = {
		department: account.department ?? user.department,
		grade: account.grade ?? user.grade,
		bio: account.bio ?? user.bio ?? '',
	};
	const customDirty = selfFields.some(
		(field) =>
			(account.customValues[field.fieldKey] ?? '') !== (data.customFields?.[field.fieldKey] ?? '')
	);
	const dirty =
		values.department !== user.department ||
		values.grade !== user.grade ||
		values.bio !== (user.bio ?? '') ||
		customDirty;
	const trackOptionsForUser = account.trackOptions.some((option) => option.value === values.department)
		? account.trackOptions
		: [
				...account.trackOptions,
				{ value: values.department, labelTr: values.department, labelEn: values.department },
			];
	const levelOptionsForUser = account.levelOptions.some((option) => Number(option.value) === values.grade)
		? account.levelOptions
		: [
				...account.levelOptions,
				{ value: String(values.grade), labelTr: `${values.grade}`, labelEn: `${values.grade}` },
			];

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
				level={level}
				busy={account.busy}
				onPhotoDone={(ok, text) => account.done('photo', ok, text)}
				onSetBusy={account.setBusy}
				note={note('photo')}
			/>

			<AccountStatsCards summary={summary} />

			<AccountProfileForm
				email={user.email}
				studentNo={user.studentNo}
				values={values}
				trackOptions={trackOptionsForUser}
				levelOptions={levelOptionsForUser}
				selfFields={selfFields}
				customValues={account.customValues}
				customErrors={account.customErrors}
				dirty={dirty}
				busy={account.busy === 'profile'}
				note={note('profile')}
				emailChange={account.emailChange}
				onDepartmentChange={account.setDepartment}
				onGradeChange={account.setGrade}
				onBioChange={account.setBio}
				onCustomChange={(fieldKey, next) =>
					account.setCustomValues((previous) => ({ ...previous, [fieldKey]: next }))
				}
				onSubmit={(e) => void account.saveProfile(e, values)}
			/>

			<AccountPasswordForm
				userEmail={user.email}
				busy={account.busy}
				onPasswordDone={(ok, text) => account.done('password', ok, text)}
				onSetBusy={account.setBusy}
				note={note('password')}
			/>

			<AccountStorageCard
				email={user.email}
				diskUsage={data.diskUsage}
				resetMessage={account.resetMessage}
				onLogout={() => void account.logout()}
				onResetWorkspace={() => void account.handleResetWorkspace()}
			/>

			<AccountLegalConsents
				missingLegal={account.missingLegal}
				activeLegal={account.activeLegal}
				legalBusy={account.legalBusy}
				onReview={account.setActiveLegal}
				onClose={() => account.setActiveLegal(null)}
				onAccept={() => void account.acceptLegalDocument()}
			/>
		</div>
	);
}
