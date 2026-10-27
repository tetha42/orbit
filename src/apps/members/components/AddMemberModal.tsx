'use client';

import React from 'react';
import { UserPlus } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';
import type { AtanabilirRol } from '../types';

interface AddMemberModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
	formError: string | null;
	newAd: string;
	setNewAd: (val: string) => void;
	newSoyad: string;
	setNewSoyad: (val: string) => void;
	newEposta: string;
	setNewEposta: (val: string) => void;
	newBolum: string;
	setNewBolum: (val: string) => void;
	newSinif: number;
	setNewSinif: (val: number) => void;
	newRolId: string;
	setNewRolId: (val: string) => void;
	newOgrenciNo: string;
	setNewOgrenciNo: (val: string) => void;
	isSubmitting: boolean;
	rolData: { roller: AtanabilirRol[]; varsayilanRolId: string | null } | null;
	rolById: Map<string, AtanabilirRol>;
	atanabilir: AtanabilirRol[];
}

export function AddMemberModal({
	isOpen,
	onClose,
	onSubmit,
	formError,
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
	rolData,
	rolById,
	atanabilir,
}: AddMemberModalProps) {
	const { t } = useI18n();

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
					<input className={ui.input} type="text" placeholder={t('membersNamePh')} value={newAd} onChange={(e) => setNewAd(e.target.value)} required />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersLastName')}</span>
					<input className={ui.input} type="text" placeholder={t('membersSurnamePh')} value={newSoyad} onChange={(e) => setNewSoyad(e.target.value)} required />
				</label>
			</div>

			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('membersEmailLabel')}</span>
				<input className={ui.input} type="email" placeholder="uye@orbit.local" value={newEposta} onChange={(e) => setNewEposta(e.target.value)} required />
			</label>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersDeptLabel')}</span>
					<input className={ui.input} type="text" placeholder={t('membersDeptPh')} value={newBolum} onChange={(e) => setNewBolum(e.target.value)} required />
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersGradeLabel')}</span>
					<select className={ui.select} style={{ maxWidth: 'none' }} value={newSinif} onChange={(e) => setNewSinif(Number(e.target.value))}>
						<option value={1}>{fill(t('certsGradeFormat'), { grade: 1 })}</option>
						<option value={2}>{fill(t('certsGradeFormat'), { grade: 2 })}</option>
						<option value={3}>{fill(t('certsGradeFormat'), { grade: 3 })}</option>
						<option value={4}>{fill(t('certsGradeFormat'), { grade: 4 })}</option>
						<option value={5}>{t('membersMasterDegree')}</option>
					</select>
				</label>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersRoleLabel')}</span>
					<select className={ui.select} style={{ maxWidth: 'none' }} value={newRolId} data-new-member-role onChange={(e) => setNewRolId(e.target.value)}>
						<option value="">
							{t('membersDefaultRole')}{rolData?.varsayilanRolId && rolById.get(rolData.varsayilanRolId) ? ` (${rolById.get(rolData.varsayilanRolId)!.ad})` : ` ${t('membersNoRoleAssigned')}`}
						</option>
						{atanabilir.map((r) => (
							<option key={r.id} value={r.id}>{r.ad}</option>
						))}
					</select>
				</label>
				<label className={ui.field}>
					<span className={ui.fieldLabel}>{t('membersStudentIdLabel')}</span>
					<input className={ui.input} type="text" placeholder="230101001" value={newOgrenciNo} onChange={(e) => setNewOgrenciNo(e.target.value)} />
				</label>
			</div>
		</Sheet>
	);
}
