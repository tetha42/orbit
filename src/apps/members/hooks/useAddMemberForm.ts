import type React from 'react';
import { useEffect, useState } from 'react';
import { invalidateResource } from '@/core/data/useJsonResource';
import type { DialogApi } from '@/components/Common/DialogProvider';
import {
	fieldAppliesTo,
	fieldRequiredFor,
	type FormField,
} from '@/lib/formFields';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	defaultLevelValue,
	defaultTrackValue,
	normalizeRegistrationCoreConfig,
	type RegistrationCoreConfig,
} from '@/lib/i18n/data/registrationConfig';
import { fill } from '@/lib/text';
import { mapMemberContractError } from '../utils/memberContracts';

interface UseAddMemberFormParams {
	t: (key: string, fallback?: string) => string;
	dialog: DialogApi;
	playSystemSound: () => void;
	fetchMembers: () => Promise<unknown>;
}

export function useAddMemberForm({
	t,
	dialog,
	playSystemSound,
	fetchMembers,
}: UseAddMemberFormParams) {
	const [showAddModal, setShowAddModal] = useState(false);
	const [newFirstName, setNewFirstName] = useState('');
	const [newLastName, setNewLastName] = useState('');
	const [newEmail, setNewEmail] = useState('');
	const [newTrack, setNewTrack] = useState(() => defaultTrackValue(DEFAULT_REGISTRATION_CORE_CONFIG));
	const [newGrade, setNewGrade] = useState(() => defaultLevelValue(DEFAULT_REGISTRATION_CORE_CONFIG));
	const [newRoleId, setNewRoleId] = useState('');
	const [newMemberHandle, setNewMemberHandle] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [memberFields, setMemberFields] = useState<FormField[]>([]);
	const [coreConfig, setCoreConfig] = useState<RegistrationCoreConfig>(
		DEFAULT_REGISTRATION_CORE_CONFIG,
	);
	const [customValues, setCustomValues] = useState<Record<string, string>>({});
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const loadMetadata = async () => {
			try {
				const [fieldsRes, configRes] = await Promise.all([
					fetch('/api/form-fields?scope=member', { cache: 'no-store' }),
					fetch('/api/registration-config', { cache: 'no-store' }),
				]);
				if (cancelled) return;
				if (fieldsRes.ok) {
					const data = await fieldsRes.json();
					if (Array.isArray(data.fields)) setMemberFields(data.fields);
				}
				if (configRes.ok) {
					const data = await configRes.json();
					if (data.config) {
						const normalized = normalizeRegistrationCoreConfig(data.config);
						setCoreConfig(normalized);
						setNewTrack((prev) =>
							normalized.track.options.some((opt) => opt.value === prev)
								? prev
								: defaultTrackValue(normalized),
						);
						setNewGrade((prev) =>
							normalized.level.options.some((opt) => Number(opt.value) === prev)
								? prev
								: defaultLevelValue(normalized),
						);
					}
				}
			} catch {
				// Keep fallback defaults if metadata load fails.
			}
		};
		void loadMetadata();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleAddMember = async (event: React.FormEvent) => {
		event.preventDefault();
		if (isSubmitting) return;
		setFormError(null);
		setFieldErrors({});

		if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newTrack.trim()) {
			setFormError(t('membersFormMissing'));
			return;
		}
		if (coreConfig.memberId.required && !newMemberHandle.trim()) {
			setFormError(t('authMemberIdRequired', 'Please enter a member ID / handle.'));
			return;
		}

		const nextErrors: Record<string, string> = {};
		for (const field of memberFields) {
			if (!fieldAppliesTo(field, 'member') || !fieldRequiredFor(field, 'member')) continue;
			if (!String(customValues[field.fieldKey] ?? '').trim()) {
				nextErrors[field.fieldKey] = t('authRequiredField');
			}
		}
		if (Object.keys(nextErrors).length > 0) {
			setFieldErrors(nextErrors);
			setFormError(t('membersFormMissing'));
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch('/api/members', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					firstName: newFirstName.trim(),
					lastName: newLastName.trim(),
					email: newEmail.trim(),
					department: newTrack,
					grade: newGrade,
					handle: newMemberHandle.trim() || undefined,
					password: newPassword || undefined,
					...(newRoleId ? { roleId: newRoleId } : {}),
					customFields: customValues,
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				if (data.fieldErrors && typeof data.fieldErrors === 'object') {
					setFieldErrors(data.fieldErrors);
				}
				setFormError(mapMemberContractError(data.code, data.error || t('membersAddFailed'), t));
				return;
			}

			const createdFullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim();
			setNewFirstName('');
			setNewLastName('');
			setNewEmail('');
			setNewMemberHandle('');
			setNewRoleId('');
			setNewPassword('');
			setCustomValues({});
			setFieldErrors({});
			setFormError(null);
			setShowAddModal(false);
			playSystemSound();
			invalidateResource('/api/members');
			await fetchMembers();

			if (data.temporaryPassword) {
				void dialog.alert({
					title: t('membersCreatedTitle'),
					message: fill(t('membersTempPasswordNotice'), {
						name: createdFullName,
						password: data.temporaryPassword,
					}),
					tone: 'success',
				});
			}
		} catch {
			setFormError(t('connError'));
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		showAddModal,
		setShowAddModal,
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
		formError,
		handleAddMember,
	};
}
