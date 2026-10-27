'use client';

import { useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useAppEvent, useAppCommand } from '@/core/commands';
import { errorMessage } from '@/lib/errors';
import { fill } from '@/lib/text';
import type { MemberRecord, AtanabilirRol } from '../types';

export function useMembers() {
	const { currentUser, canManageApp, canUseApp } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();

	const mailUser = canUseApp('chat');
	const { data: reachData } = useJsonResource<{ idler: string[] }>(
		mailUser ? '/api/posta/alicilar?ulasilabilir=1' : null
	);
	const reachable = new Set(reachData?.idler ?? []);

	const isAuthorizedToAdd = canManageApp('members');
	const { data: rolData } = useJsonResource<{ roller: AtanabilirRol[]; varsayilanRolId: string | null }>(
		isAuthorizedToAdd ? '/api/roles' : null
	);
	const roller = rolData?.roller ?? [];
	const atanabilir = roller.filter((r) => r.atanabilir);
	const rolById = new Map(roller.map((r) => [r.id, r]));

	const dokunulabilir = (m: MemberRecord) => !m.roleId || rolById.get(m.roleId)?.atanabilir === true;

	const { data: membersData, refetch: fetchMembers, isLoading } = useJsonResource<{
		members: MemberRecord[];
	}>('/api/members');
	const members = membersData?.members ?? [];

	useAppEvent('roster-changed', () => void fetchMembers());

	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState<'all' | 'aktif' | 'beklemede' | 'mezun'>('all');
	const [rolFilter, setRolFilter] = useState<string>('');
	const [selectedDept, setSelectedDept] = useState<string>('');
	const [selectedClass, setSelectedClass] = useState<number>(0);
	const [showAddModal, setShowAddModal] = useState(false);

	useFocusTarget('members', {
		ready: !isLoading,
		apply: () => {
			setActiveFilter('all');
			setRolFilter('');
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
	const [newAd, setNewAd] = useState('');
	const [newSoyad, setNewSoyad] = useState('');
	const [newEposta, setNewEposta] = useState('');
	const [newBolum, setNewBolum] = useState(t('membersDefaultDept'));
	const [newSinif, setNewSinif] = useState(1);
	const [newRolId, setNewRolId] = useState('');
	const [newOgrenciNo, setNewOgrenciNo] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const handleAddMember = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);
		if (!newAd.trim() || !newSoyad.trim() || !newEposta.trim()) {
			setFormError(t('membersFormMissing'));
			return;
		}

		try {
			setIsSubmitting(true);
			const res = await fetch('/api/members', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ad: newAd.trim(),
					soyad: newSoyad.trim(),
					email: newEposta.trim(),
					bolum: newBolum,
					sinif: newSinif,
					...(newRolId ? { roleId: newRolId } : {}),
					ogrenciNo: newOgrenciNo.trim(),
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || t('membersAddFailed'));
			}

			playSystemSound();
			setShowAddModal(false);
			setNewAd('');
			setNewSoyad('');
			setNewEposta('');
			setNewOgrenciNo('');
			setNewRolId('');
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
	};

	const handleUpdateMemberRole = async (id: string, roleId: string) => {
		try {
			const res = await fetch('/api/members', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, roleId: roleId || null }),
			});
			if (res.ok) {
				playSystemSound();
				await fetchMembers();
			} else {
				const data = await res.json();
				void dialog.alert({ message: data.error || t('actionFailed'), tone: 'danger' });
			}
		} catch {
			void dialog.alert({ message: t('connError'), tone: 'danger' });
		}
	};

	const handleUpdateMemberStatus = async (id: string, status: 'aktif' | 'reddedildi' | 'mezun') => {
		try {
			const res = await fetch('/api/members', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, status }),
			});
			if (res.ok) {
				playSystemSound();
				await fetchMembers();
			} else {
				const data = await res.json();
				void dialog.alert({ message: data.error || t('actionFailed'), tone: 'danger' });
			}
		} catch {
			void dialog.alert({ message: t('connError'), tone: 'danger' });
		}
	};

	const handleAwardXp = async (id: string, addXp: number) => {
		try {
			const res = await fetch('/api/members', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, addXp }),
			});
			if (res.ok) {
				playSystemSound();
				await fetchMembers();
			}
		} catch {
			void dialog.alert({ message: t('connError'), tone: 'danger' });
		}
	};

	const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<MemberRecord | null>(null);

	const handleResetPassword = async (id: string, name: string) => {
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
	};

	const handleDeleteMember = async (id: string, name: string) => {
		const confirmed = await dialog.confirm({
			message: fill(t('membersDeleteConfirmMsg'), { name }),
			tone: 'danger',
		});
		if (!confirmed) return;
		try {
			const res = await fetch(`/api/members?id=${id}`, { method: 'DELETE' });
			if (res.ok) {
				playSystemSound();
				await fetchMembers();
			} else {
				const data = await res.json();
				void dialog.alert({ message: data.error || t('membersDeleteFailed'), tone: 'danger' });
			}
		} catch {
			void dialog.alert({ message: t('connError'), tone: 'danger' });
		}
	};

	const filteredMembers = members.filter((m) => {
		const fullName = `${m.ad} ${m.soyad}`.toLowerCase();
		const matchesSearch =
			fullName.includes(searchQuery.toLowerCase()) ||
			m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
			m.bolum.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(m.takimAdi && m.takimAdi.toLowerCase().includes(searchQuery.toLowerCase()));

		if (selectedDept && selectedDept !== '' && m.bolum !== selectedDept) return false;
		if (selectedClass !== 0 && String(m.sinif) !== String(selectedClass)) return false;
		if (rolFilter && (m.roleId ?? '') !== (rolFilter === '-' ? '' : rolFilter)) return false;

		if (activeFilter === 'aktif') return matchesSearch && m.status === 'aktif';
		if (activeFilter === 'beklemede') return matchesSearch && m.status === 'beklemede';
		if (activeFilter === 'mezun') return matchesSearch && (m.status === 'mezun' || m.roleId === 'rol_mezun');
		return matchesSearch;
	});

	const rolSecenekleri = [
		...new Map([
			...roller.map((r) => [r.id, r.ad] as [string, string]),
			...members.filter((m) => m.roleId).map((m) => [m.roleId!, m.rolAd ?? m.roleId!] as [string, string]),
		]).entries(),
	];
	const rolsuzVar = members.some((m) => !m.roleId);

	return {
		currentUser,
		mailUser,
		reachable,
		isAuthorizedToAdd,
		isLoading,
		members,
		filteredMembers,
		roller,
		atanabilir,
		rolById,
		rolData,
		rolSecenekleri,
		rolsuzVar,
		dokunulabilir,
		searchQuery,
		setSearchQuery,
		activeFilter,
		setActiveFilter,
		rolFilter,
		setRolFilter,
		selectedDept,
		setSelectedDept,
		selectedClass,
		setSelectedClass,
		showAddModal,
		setShowAddModal,
		newAd,
		setNewAd,
		newSoyad,
		setNewSoyad,
		newEposta,
		setNewEposta,
		newBolum,
		setNewBolum,
		newSinif,
		setNewSinif,
		newRolId,
		setNewRolId,
		newOgrenciNo,
		setNewOgrenciNo,
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
		t,
	};
}
