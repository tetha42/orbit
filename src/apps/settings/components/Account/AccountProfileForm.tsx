'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { BIO_MAX } from '@/lib/profile';
import { optionLabel, type FormField, type FormFieldOption } from '@/lib/formFields';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';
import { AccountEmailChangeBox } from './AccountEmailChangeBox';
import { AccountCustomFields } from './AccountCustomFields';

interface AccountProfileFormProps {
	email: string;
	studentNo: string | null;
	values: { department: string; grade: number; bio: string };
	trackOptions: FormFieldOption[];
	levelOptions: FormFieldOption[];
	selfFields: FormField[];
	customValues: Record<string, string>;
	customErrors: Record<string, string>;
	dirty: boolean;
	busy: boolean;
	note?: React.ReactNode;
	emailChange: {
		emailOpen: boolean;
		setEmailOpen: React.Dispatch<React.SetStateAction<boolean>>;
		emailStep: 'request' | 'verify';
		newEmail: string;
		setNewEmail: (value: string) => void;
		emailCode: string;
		setEmailCode: (value: string) => void;
		emailBusy: boolean;
		emailMsg: { text: string; tone: 'ok' | 'err' } | null;
		closeEmailChange: () => void;
		requestEmailCode: () => void;
		confirmEmailCode: () => void;
	};
	onDepartmentChange: (value: string) => void;
	onGradeChange: (value: number) => void;
	onBioChange: (value: string) => void;
	onCustomChange: (fieldKey: string, value: string) => void;
	onSubmit: (e: React.FormEvent) => void;
}

export function AccountProfileForm({
	email,
	studentNo,
	values,
	trackOptions,
	levelOptions,
	selfFields,
	customValues,
	customErrors,
	dirty,
	busy,
	note,
	emailChange,
	onDepartmentChange,
	onGradeChange,
	onBioChange,
	onCustomChange,
	onSubmit,
}: AccountProfileFormProps) {
	const { t, language } = useI18n();

	return (
		<form className={styles.card} onSubmit={onSubmit} aria-label={t('acProfile')}>
			<h4 className={styles.cardTitle}>{t('acProfile')}</h4>
			<div className={styles.grid2}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('acEmail')}</span>
					<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
						<input className={ui.input} value={email} disabled style={{ flex: 1, minWidth: 0 }} />
						<button
							type="button"
							className={ui.btn}
							onClick={() => emailChange.setEmailOpen((open) => !open)}
							disabled={emailChange.emailBusy}
						>
							{t('acChangeEmail')}
						</button>
					</div>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('acStudentNo')}</span>
					<input className={ui.input} value={studentNo ?? '—'} disabled />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('acDepartment')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none' }}
						value={values.department}
						onChange={(e) => onDepartmentChange(e.target.value)}
					>
						{trackOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{optionLabel(option, language)}
							</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('acYear')}</span>
					<select
						className={ui.select}
						style={{ maxWidth: 'none' }}
						value={values.grade}
						onChange={(e) => onGradeChange(Number(e.target.value))}
					>
						{levelOptions.map((option) => (
							<option key={option.value} value={Number(option.value)}>
								{optionLabel(option, language)}
							</option>
						))}
					</select>
				</label>
			</div>

			{emailChange.emailOpen && (
				<AccountEmailChangeBox
					currentEmail={email}
					emailStep={emailChange.emailStep}
					newEmail={emailChange.newEmail}
					emailCode={emailChange.emailCode}
					emailBusy={emailChange.emailBusy}
					emailMsg={emailChange.emailMsg}
					onNewEmailChange={emailChange.setNewEmail}
					onEmailCodeChange={emailChange.setEmailCode}
					onRequestCode={() => void emailChange.requestEmailCode()}
					onConfirmCode={() => void emailChange.confirmEmailCode()}
					onClose={emailChange.closeEmailChange}
				/>
			)}

			<label className={ui.field}>
				<span className={ui.fieldLabel} style={{ display: 'flex' }}>
					{t('acBio')}
					<span style={{ marginLeft: 'auto', fontWeight: 500 }}>
						{values.bio.length}/{BIO_MAX}
					</span>
				</span>
				<textarea
					className={ui.textarea}
					rows={3}
					maxLength={BIO_MAX}
					value={values.bio}
					placeholder={t('acBioPh')}
					onChange={(e) => onBioChange(e.target.value)}
				/>
			</label>

			<AccountCustomFields
				fields={selfFields}
				customValues={customValues}
				customErrors={customErrors}
				onChange={onCustomChange}
			/>

			<div className={ui.btnRow} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
				<span className={ui.hint}>{t('acIdentityHint')}</span>
				<button type="submit" className={ui.primaryBtn} disabled={!dirty || busy}>
					{t('acSave')}
				</button>
			</div>
			{note}
		</form>
	);
}
