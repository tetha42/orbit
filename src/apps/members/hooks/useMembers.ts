'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource, invalidateResource } from '@/core/data/useJsonResource';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useAppEvent, useAppCommand } from '@/core/commands';
import { errorMessage } from '@/lib/errors';
import { fill } from '@/lib/text';
import type { MemberRecord, AssignableRole } from '../types';
import { fieldAppliesTo, fieldRequiredFor, type FormField, type FormFieldOption } from '@/lib/formFields';
import {
	DEFAULT_REGISTRATION_CORE_CONFIG,
	defaultLevelValue,
	defaultTrackValue,
	type RegistrationCoreConfig,
} from '@/lib/registrationConfig';

export function useMembers() {
	const { currentUser, canManageApp, canUseApp } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();

	const mailUser = canUseApp('chat');
	const { data: reachData } = useJsonResource<{ idler: string[] }>(
		mailUser ? '/api/posta/alicilar?ulasilabilir=1' : null
	);
	const reachable = useMemo(() => new Set(reachData?.idler ?? []), [reachData?.idler]);

	const isAuthorizedToAdd = canManageApp('members');
	const { data: roleData } = useJsonResource<{ roller: AssignableRole[]; varsayilanRolId: string | null }>(
		isAuthorizedToAdd ? '/api/roles' : null
	);
	const roles = useMemo(() => roleData?.roller ?? [], [roleData?.roller]);
	const assignableRoles = useMemo(() => roles.filter((r) => r.assignableRoles), [roles]);
	const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

	const isMemberTouchable = useCallback(
		(m: MemberRecord) => !m.roleId || rolesById.get(m.roleId)?.assignableRoles === true,
		[rolesById]
	);

	const { data: membersData, refetch: fetchMembers, isLoading } = useJsonResource<{
		members: MemberRecord[];
	}>('/api/members');
	const members = useMemo(() => membersData?.members ?? [], [membersData?.members]);

	useAppEvent('roster-changed', () => void fetchMembers());

	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState<'all' | 'aktif' | 'beklemede' | 'mezun'>('all');
	const [roleFilter, setRoleFilter] = useState<string>('');
	const [selectedDepartment, setSelectedDepartment] = useState<string>('');
	const [selectedGrade, setSelectedGrade] = useState<number>(0);
	const [showAddModal, setShowAddModal] = useState(false);

	useFocusTarget('members', {
		ready: !isLoading,
		apply: () => {
			setActiveFilter('all');
			setRoleFilter('');
			setSearchQuery('');
		},
		refetch: fetchMembers,
	});

	useAppCommand('members', (command) => {
		if (command === 'add-member' && isAuthorizedToAdd) setShowAddModal(true);
		else if (command === 'refresh') void fetchMembers();
		else if (command === 'filter-all') setActiveFilter('all');
		else if (command === 'filter-active') setActiveFilter('aktif');
		else if (command === 'filter-pending' && isAuthorizedToAdd) setActiveFilter('beklemede');
		else if (command === 'filter-alumni') setActiveFilter('mezun');
	});

	// New member state
	const [newFirstName, setNewFirstName] = useState('');
	const [newLastName, setNewLastName] = useState('');
	const [newEmail, setNewEmail] = useState('');
	const [newTrack, setNewTrack] = useState(defaultTrackValue(DEFAULT_REGISTRATION_CORE_CONFIG));
	const [newGrade, setNewGrade] = useState(
		defaultLevelValue(DEFAULT_REGISTRATION_CORE_CONFIG)
	);
	const [newRoleId, setNewRoleId] = useState('');
	const [newMemberHandle, setNewMemberHandle] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [memberFields, setMemberFields] = useState<FormField[]>([]);
	const [coreConfig, setCoreConfig] = useState<RegistrationCoreConfig>(
		DEFAULT_REGISTRATION_CORE_CONFIG
	);
	const [customValues, setCustomValues] = useState<Record<string, string>>({});
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	// The same community-defined fields used by the public registration form,
	// scoped to member records. Loaded once; a failure leaves only core fields.
	useEffect(() => {
		let cancelled = false;
		Promise.all([
			fetch('/api/form-fields?scope=member', { cache: 'no-store' }).then((res) =>
				res.ok ? res.json() : null
			),
			fetch('/api/registration-config', { cache: 'no-store' }).then((res) =>
				res.ok ? res.json() : null
			),
		])
			.then(([data, configData]) => {
				if (cancelled) return;
				if (Array.isArray(data?.fields)) setMemberFields(data.fields);
				if (configData?.config) {
					const config = configData.config as RegistrationCoreConfig;
					setCoreConfig(config);
					setNewTrack((previous) =>
						config.track.options.some((option) => option.value === previous)
							? previous
							: defaultTrackValue(config)
					);
					setNewGrade((previous) =>
						config.level.options.some((option) => Number(option.value) === previous)
							? previous
							: defaultLevelValue(config)
					);
				}
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	const handleAddMember = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setFormError(null);
			if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newTrack.trim()) {
				setFormError(t('membersFormMissing'));
				return;
			}
			if (coreConfig.memberId.required && !newMemberHandle.trim()) {
				setFormError(t('authMemberIdRequired', 'Please enter a member ID / handle.'));
				return;
			}
			const missingCustom = memberFields.filter(
				(field) =>
					fieldAppliesTo(field, 'member') &&
					fieldRequiredFor(field, 'member') &&
					!customValues[field.fieldKey]?.trim()
			);
			if (missingCustom.length > 0) {
				setFieldErrors(
					Object.fromEntries(
						missingCustom.map((field) => [
							field.fieldKey,
							t('authRequiredField', 'This field is required.'),
						])
					)
				);
				setFormError(t('membersFormMissing'));
				return;
			}
			setFieldErrors({});

			try {
				setIsSubmitting(true);
				const res = await fetch('/api/members', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						ad: newFirstName.trim(),
						soyad: newLastName.trim(),
						email: newEmail.trim(),
						bolum: newTrack,
						sinif: newGrade,
						...(newRoleId ? { roleId: newRoleId } : {}),
						ogrenciNo: newMemberHandle.trim(),
						...(newPassword ? { password: newPassword } : {}),
						customFields: customValues,
					}),
				});

				const data = await res.json();
				if (res.status === 400 && data.fieldErrors) setFieldErrors(data.fieldErrors);
				if (!res.ok) {
					throw new Error(data.error || t('membersAddFailed'));
				}

				playSystemSound();
				setShowAddModal(false);
				setNewFirstName('');
				setNewLastName('');
				setNewEmail('');
				setNewMemberHandle('');
				setNewRoleId('');
				setNewPassword('');
				setCustomValues({});
				setFieldErrors({});
				invalidateResource('/api/members');
				await fetchMembers();

				if (data.geciciSifre) {
					void dialog.alert({
						title: t('membersCreatedTitle'),
						message: fill(t('membersTempPasswordNotice'), {
							name: `${data.member?.ad ?? ''} ${data.member?.soyad ?? ''}`.trim(),
							password: data.geciciSifre,
						}),
						tone: 'success',
					});
				}
			} catch (err) {
				setFormError(errorMessage(err) || t('membersAddFailed'));
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			newFirstName,
			newLastName,
			newEmail,
			newTrack,
			newGrade,
			newRoleId,
			newMemberHandle,
			newPassword,
			memberFields,
			coreConfig,
			customValues,
			fetchMembers,
			playSystemSound,
			dialog,
			t,
		]
	);

	const handleUpdateMemberRole = useCallback(
		async (id: string, roleId: string) => {
			try {
				const res = await fetch('/api/members', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id, roleId: roleId || null }),
				});
				if (res.ok) {
					playSystemSound();
					invalidateResource('/api/members');
					await fetchMembers();
				} else {
					const data = await res.json();
					void dialog.alert({ message: data.error || t('actionFailed'), tone: 'danger' });
				}
			} catch {
				void dialog.alert({ message: t('connError'), tone: 'danger' });
			}
		},
		[fetchMembers, playSystemSound, dialog, t]
	);

	const handleUpdateMemberStatus = useCallback(
		async (id: string, status: 'aktif' | 'reddedildi' | 'mezun') => {
			try {
				const res = await fetch('/api/members', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id, status }),
				});
				if (res.ok) {
					playSystemSound();
					invalidateResource('/api/members');
					await fetchMembers();
				} else {
					const data = await res.json();
					void dialog.alert({ message: data.error || t('actionFailed'), tone: 'danger' });
				}
			} catch {
				void dialog.alert({ message: t('connError'), tone: 'danger' });
			}
		},
		[fetchMembers, playSystemSound, dialog, t]
	);

	const handleAwardXp = useCallback(
		async (id: string, addXp: number) => {
			try {
				const res = await fetch('/api/members', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id, addXp }),
				});
				if (res.ok) {
					playSystemSound();
					invalidateResource('/api/members');
					await fetchMembers();
				}
			} catch {
				void dialog.alert({ message: t('connError'), tone: 'danger' });
			}
		},
		[fetchMembers, playSystemSound, dialog, t]
	);

	const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<MemberRecord | null>(null);

	const handleResetPassword = useCallback(
		async (id: string, name: string) => {
			const confirmed = await dialog.confirm({
				title: t('dlgConfirmTitle'),
				message: fill(t('membersResetPassConfirm'), { name }),
				tone: 'warning',
			});
			if (!confirmed) return;

			try {
				const res = await fetch('/api/members', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id, sifreSifirla: true }),
				});
				const data = await res.json();
				if (res.ok && data.geciciSifre) {
					playSystemSound();
					void dialog.alert({
						title: t('membersCtxResetPassword'),
						message: `${fill(t('membersResetPassSuccess'), { name })}\n\n${data.geciciSifre}\n\n${t('membersResetPassNotice')}`,
						tone: 'success',
					});
				} else {
					void dialog.alert({ message: data.error || t('actionFailed'), tone: 'danger' });
				}
			} catch {
				void dialog.alert({ message: t('connError'), tone: 'danger' });
			}
		},
		[dialog, playSystemSound, t]
	);

	const handleSendPasswordResetEmail = useCallback(
		async (id: string, name: string) => {
			const confirmed = await dialog.confirm({
				title: t('membersSendResetEmail'),
				message: fill(t('membersSendResetEmailConfirm'), { name }),
				tone: 'warning',
			});
			if (!confirmed) return;
			try {
				const res = await fetch(`/api/members/${encodeURIComponent(id)}/password-reset`, {
					method: 'POST',
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error || t('membersSendResetEmailFailed'));
				playSystemSound();
				void dialog.alert({
					title: t('membersSendResetEmail'),
					message: fill(t('membersSendResetEmailSuccess'), { name }),
					tone: 'success',
				});
			} catch (error) {
				void dialog.alert({
					message: error instanceof Error ? error.message : t('membersSendResetEmailFailed'),
					tone: 'danger',
				});
			}
		},
		[dialog, playSystemSound, t]
	);

	const handleDeleteMember = useCallback(
		async (id: string, name: string) => {
			const confirmed = await dialog.confirm({
				message: fill(t('membersDeleteConfirmMsg'), { name }),
				tone: 'danger',
			});
			if (!confirmed) return;
			try {
				const res = await fetch(`/api/members?id=${id}`, { method: 'DELETE' });
				if (res.ok) {
					playSystemSound();
					invalidateResource('/api/members');
					await fetchMembers();
				} else {
					const data = await res.json();
					void dialog.alert({ message: data.error || t('membersDeleteFailed'), tone: 'danger' });
				}
			} catch {
				void dialog.alert({ message: t('connError'), tone: 'danger' });
			}
		},
		[dialog, playSystemSound, fetchMembers, t]
	);

	const filteredMembers = useMemo(() => {
		return members.filter((m) => {
			const fullName = `${m.ad} ${m.soyad}`.toLowerCase();
			const matchesSearch =
				fullName.includes(searchQuery.toLowerCase()) ||
				m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				m.bolum.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(m.takimAdi && m.takimAdi.toLowerCase().includes(searchQuery.toLowerCase()));

			if (selectedDepartment && selectedDepartment !== '' && m.bolum !== selectedDepartment) return false;
			if (selectedGrade !== 0 && String(m.sinif) !== String(selectedGrade)) return false;
			if (roleFilter && (m.roleId ?? '') !== (roleFilter === '-' ? '' : roleFilter)) return false;

			if (activeFilter === 'aktif') return matchesSearch && m.status === 'aktif';
			if (activeFilter === 'beklemede') return matchesSearch && m.status === 'beklemede';
			if (activeFilter === 'mezun') return matchesSearch && (m.status === 'mezun' || m.roleId === 'rol_mezun');
			return matchesSearch;
		});
	}, [members, searchQuery, selectedDepartment, selectedGrade, roleFilter, activeFilter]);

	const roleOptions = useMemo(() => {
		return [
			...new Map([
				...roles.map((r) => [r.id, r.ad] as [string, string]),
				...members.filter((m) => m.roleId).map((m) => [m.roleId!, m.rolAd ?? m.roleId!] as [string, string]),
			]).entries(),
		];
	}, [roles, members]);

	const hasRolelessMember = useMemo(() => members.some((m) => !m.roleId), [members]);
	// The configured track menu plus any historical value already on a member, so a
	// legacy track is still filterable without becoming a new selectable option.
	const trackOptions = useMemo(() => {
		const options = new Map<string, FormFieldOption>();
		for (const option of coreConfig.track.options) options.set(option.value, option);
		for (const member of membersData?.members ?? []) {
			if (member.bolum && !options.has(member.bolum)) {
				options.set(member.bolum, {
					value: member.bolum,
					labelTr: member.bolum,
					labelEn: member.bolum,
				});
			}
		}
		return [...options.values()];
	}, [coreConfig, membersData]);

	return {
		currentUser,
		mailUser,
		reachable,
		isAuthorizedToAdd,
		isLoading,
		members,
		filteredMembers,
		roles,
		assignableRoles,
		rolesById,
		roleData,
		roleOptions,
		hasRolelessMember,
		trackOptions,
		isMemberTouchable,
		searchQuery,
		setSearchQuery,
		activeFilter,
		setActiveFilter,
		roleFilter,
		setRoleFilter,
		selectedDepartment,
		setSelectedDepartment,
		selectedGrade,
		setSelectedGrade,
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
		fetchMembers,
		handleAddMember,
		handleUpdateMemberRole,
		handleUpdateMemberStatus,
		handleAwardXp,
		handleDeleteMember,
		selectedMemberForProfile,
		setSelectedMemberForProfile,
		handleResetPassword,
		handleSendPasswordResetEmail,
		t,
	};
}
