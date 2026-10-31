'use client';

import React from 'react';
import { UserPlus } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import type { AssignableRole } from '../types';
import type { RegistrationCoreConfig } from '@/lib/registrationConfig';
import { fieldAppliesTo, fieldLabel, fieldPlaceholder, fieldRequiredFor, optionLabel, type FormField } from '@/lib/formFields';

interface AddMemberModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
	formError: string | null;
	newFirstName: string;
	setNewFirstName: (val: string) => void;
	newLastName: string;
	setNewLastName: (val: string) => void;
	newEmail: string;
	setNewEmail: (val: string) => void;
	newTrack: string;
	setNewTrack: (val: string) => void;
	newGrade: number;
	setNewGrade: (val: number) => void;
	newRoleId: string;
	setNewRoleId: (val: string) => void;
	newMemberHandle: string;
	setNewMemberHandle: (val: string) => void;
	newPassword: string;
	setNewPassword: (val: string) => void;
	memberFields: FormField[];
	coreConfig: RegistrationCoreConfig;
	customValues: Record<string, string>;
	setCustomValues: (updater: (previous: Record<string, string>) => Record<string, string>) => void;
	fieldErrors: Record<string, string>;
	isSubmitting: boolean;
	roleData: { roller: AssignableRole[]; varsayilanRolId: string | null } | null;
	rolesById: Map<string, AssignableRole>;
	assignableRoles: AssignableRole[];
}

export function AddMemberModal({
	isOpen,
	onClose,
	onSubmit,
	formError,
	newFirstName,
	setNewFirstName,
	newLastName,
	setNewLastName,
	newEmail,
	setNewEmail,
	newTrack,
	setNewTrack,
	newGrade,
	setNewGrade,
	newRoleId,
	setNewRoleId,
	newMemberHandle,
	setNewMemberHandle,
	newPassword,
	setNewPassword,
	memberFields,
	coreConfig,
	customValues,
	setCustomValues,
	fieldErrors,
	isSubmitting,
	roleData,
	rolesById,
	assignableRoles,
}: AddMemberModalProps) {
	const { t, language } = useI18n();

	if (!isOpen) return null;

	return (
		<Sheet
			title={t('membersAddMemberModalTitle')}
			icon={<UserPlus size={20} color="#0a84ff" />}
			onClose={onClose}
			onSubmit={onSubmit}
			closeLabel={t('close')}
			maxWidth={460}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose} disabled={isSubmitting}>
						{t('btnCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={isSubmitting}>
						{isSubmitting ? t('saving') : t('membersAddMember')}
					</button>
				</>
			}
		>
			{formError && <div className={ui.error}>{formError}</div>}

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersFirstName')}</span>
					<input className={ui.input} type="text" placeholder={t('membersNamePh')} value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} required />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersLastName')}</span>
					<input className={ui.input} type="text" placeholder={t('membersSurnamePh')} value={newLastName} onChange={(e) => setNewLastName(e.target.value)} required />
				</label>
			</div>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('membersEmailLabel')}</span>
				<input className={ui.input} type="email" placeholder="uye@orbit.local" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
			</label>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('membersPasswordLabel')}</span>
				<input
					className={ui.input}
					type="password"
					autoComplete="new-password"
					minLength={8}
					value={newPassword}
					onChange={(e) => setNewPassword(e.target.value)}
					placeholder={t('membersPasswordPh')}
				/>
				<span style={{ fontSize: '10.5px', opacity: 0.55 }}>{t('membersPasswordHint')}</span>
			</label>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
				{coreConfig.track.visible && (
					<label className={ui.field}>
						<span className={ui.fieldLabel}>
							{language === 'tr' ? coreConfig.track.labelTr : coreConfig.track.labelEn}
						</span>
						<select className={ui.select} style={{ maxWidth: 'none' }} value={newTrack} onChange={(e) => setNewTrack(e.target.value)} required>
							{coreConfig.track.options.map((option) => (
								<option key={option.value} value={option.value}>
									{optionLabel(option, language)}
								</option>
							))}
						</select>
					</label>
				)}
				<label className={ui.field}>
					<span className={ui.fieldLabel}>
						{language === 'tr' ? coreConfig.level.labelTr : coreConfig.level.labelEn}
					</span>
					<select className={ui.select} style={{ maxWidth: 'none' }} value={newGrade} onChange={(e) => setNewGrade(Number(e.target.value))}>
						{coreConfig.level.options.map((option) => (
							<option key={option.value} value={Number(option.value)}>
								{optionLabel(option, language)}
							</option>
						))}
					</select>
				</label>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersRoleLabel')}</span>
					<select className={ui.select} style={{ maxWidth: 'none' }} value={newRoleId} data-new-member-role onChange={(e) => setNewRoleId(e.target.value)}>
						<option value="">
							{t('membersDefaultRole')}{roleData?.varsayilanRolId && rolesById.get(roleData.varsayilanRolId) ? ` (${rolesById.get(roleData.varsayilanRolId)!.ad})` : ` ${t('membersNoRoleAssigned')}`}
						</option>
						{assignableRoles.map((r) => (
							<option key={r.id} value={r.id}>{r.ad}</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>
						{language === 'tr' ? coreConfig.memberId.labelTr : coreConfig.memberId.labelEn}
						{coreConfig.memberId.required ? ' *' : ` (${t('authOptional', 'optional')})`}
					</span>
					<input
						className={ui.input}
						type="text"
						pattern="[A-Za-z0-9_-]{3,32}"
						minLength={3}
						maxLength={32}
						required={coreConfig.memberId.required}
						placeholder={
							language === 'tr'
								? coreConfig.memberId.placeholderTr
								: coreConfig.memberId.placeholderEn
						}
						value={newMemberHandle}
						onChange={(e) => setNewMemberHandle(e.target.value)}
					/>
				</label>
			</div>

			{memberFields.filter((field) => fieldAppliesTo(field, 'member')).length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
					<div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
						{t('membersAdditionalFields')}
					</div>
					{memberFields
						.filter((field) => fieldAppliesTo(field, 'member'))
						.map((field) => (
							<label key={field.id} className={ui.field}>
								<span className={ui.fieldLabel}>
									{fieldLabel(field, language)}
									{fieldRequiredFor(field, 'member') ? ' *' : ''}
								</span>
								{field.type === 'textarea' ? (
									<textarea
										className={ui.input}
										rows={3}
										value={customValues[field.fieldKey] ?? ''}
										placeholder={fieldPlaceholder(field, language)}
										aria-invalid={Boolean(fieldErrors[field.fieldKey])}
										onChange={(e) =>
											setCustomValues((previous) => ({ ...previous, [field.fieldKey]: e.target.value }))
										}
									/>
								) : field.type === 'select' ? (
									<select
										className={ui.select}
										style={{ maxWidth: 'none' }}
										value={customValues[field.fieldKey] ?? ''}
										aria-invalid={Boolean(fieldErrors[field.fieldKey])}
										onChange={(e) =>
											setCustomValues((previous) => ({ ...previous, [field.fieldKey]: e.target.value }))
										}
									>
										<option value="">{t('authSelectOption')}</option>
										{field.options.map((option) => (
											<option key={option.value} value={option.value}>
												{optionLabel(option, language)}
											</option>
										))}
									</select>
								) : (
									<input
										className={ui.input}
										type={field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : field.type}
										value={customValues[field.fieldKey] ?? ''}
										placeholder={fieldPlaceholder(field, language)}
										aria-invalid={Boolean(fieldErrors[field.fieldKey])}
										onChange={(e) =>
											setCustomValues((previous) => ({ ...previous, [field.fieldKey]: e.target.value }))
										}
									/>
								)}
								{fieldErrors[field.fieldKey] && (
									<span style={{ fontSize: 11, color: '#ff453a' }}>{fieldErrors[field.fieldKey]}</span>
								)}
							</label>
						))}
				</div>
			)}
		</Sheet>
	);
}
