'use client';

import React from 'react';
import Image from 'next/image';
import {
	User,
	Mail,
	Award,
	GraduationCap,
	CheckCircle2,
	Clock,
	XCircle,
	Calendar,
	BookOpen,
	Hash,
	Users,
	Pencil,
	KeyRound,
	HardDrive,
} from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { AvatarFallback } from '@/components/Common/AvatarFallback';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { isAlumniRole } from '@/core/permissions';
import { useI18n } from '@/core/i18n';
import { formatBytes } from '@/core/data/format';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';
import type { MemberRecord } from '../types';
import { fieldLabel, optionLabel, type FormField } from '@/lib/formFields';
import { MemberEditSheet } from './MemberEditSheet';

interface MemberDetailModalProps {
	member: MemberRecord | null;
	isOpen: boolean;
	onClose: () => void;
	currentUserId?: string;
	mailUser: boolean;
	isReachable: boolean;
	onSendMessage?: (memberId: string) => void;
	canEdit?: boolean;
	onSaved?: () => void;
	onSendPasswordReset?: () => void;
}

export function MemberDetailModal({
	member,
	isOpen,
	onClose,
	currentUserId,
	mailUser,
	isReachable: _isReachable,
	onSendMessage,
	canEdit = false,
	onSaved,
	onSendPasswordReset,
}: MemberDetailModalProps) {
	const { t, language } = useI18n();
	const [memberFields, setMemberFields] = React.useState<FormField[]>([]);
	const [adminData, setAdminData] = React.useState<{
		customFields?: Record<string, string>;
		fields?: FormField[];
	} | null>(null);
	const [editOpen, setEditOpen] = React.useState(false);

	React.useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		fetch('/api/form-fields?scope=directory', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (!cancelled && Array.isArray(data?.fields)) setMemberFields(data.fields);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [isOpen]);

	React.useEffect(() => {
		if (!isOpen || !member?.id) {
			setAdminData(null);
			return;
		}
		if (canEdit) {
			let cancelled = false;
			fetch(`/api/members/${encodeURIComponent(member.id)}`, { cache: 'no-store' })
				.then((res) => (res.ok ? res.json() : null))
				.then((data) => {
					if (!cancelled && data?.success) {
						setAdminData({
							customFields: data.customFields,
							fields: data.allFields || data.fields,
						});
					}
				})
				.catch(() => {});
			return () => {
				cancelled = true;
			};
		}
	}, [isOpen, member?.id, canEdit]);

	const memberTeams = React.useMemo(() => {
		const teams = member?.teams ?? [];
		return [...new Map(teams.map((team) => [team.id, team])).values()];
	}, [member]);

	if (!isOpen || !member) return null;

	if (editOpen) {
		return (
			<MemberEditSheet
				memberId={member.id}
				onClose={() => setEditOpen(false)}
				onSaved={() => {
					onSaved?.();
					onClose();
				}}
			/>
		);
	}

	const isSelf = member.id === currentUserId;
	const canMessage = mailUser && !isSelf && member.status === 'active';
	const isAlumni = member.status === 'alumni' || isAlumniRole({ id: member.roleId, name: member.roleName });
	const displayRole = isAlumni
		? {
				name: isAlumniRole({ id: member.roleId, name: member.roleName })
					? (member.roleName ?? t('membersStatusAlumni', 'Mezun'))
					: t('membersStatusAlumni', 'Mezun'),
				color: isAlumniRole({ id: member.roleId, name: member.roleName }) ? (member.roleColor ?? '#64d2ff') : '#64d2ff',
		  }
		: member.roleId
		? { name: member.roleName ?? '—', color: member.roleColor ?? '#8e8e93' }
		: null;
	const joinDate = member.creation
		? new Intl.DateTimeFormat(language, {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
		  }).format(new Date(member.creation))
		: null;

	return (
		<Sheet
			title={t('membersProfileTitle')}
			icon={<User size={20} color="#0a84ff" />}
			onClose={onClose}
			closeLabel={t('close')}
			maxWidth={480}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
				{/* Hero header with Avatar & Primary info */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '16px',
						padding: '12px 14px',
						background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
						borderRadius: '12px',
						border: '1px solid var(--window-border)',
					}}
				>
					{member.avatarUrl || member.profilePhoto ? (
						<Image
							src={(member.avatarUrl || member.profilePhoto)!}
							alt={`${member.firstName} ${member.lastName}`}
							width={54}
							height={54}
							unoptimized
							style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover' }}
						/>
					) : (
						<AvatarFallback name={`${member.firstName} ${member.lastName}`} size={54} />
					)}
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
							{member.firstName} {member.lastName}
						</div>
						<div style={{ fontSize: '12.5px', opacity: 0.7, wordBreak: 'break-all' }}>
							{member.email}
						</div>
						<div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
							<RoleBadge
								role={displayRole}
								emptyText={t('roleNone')}
							/>
							<span
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '4px',
									fontSize: '11px',
									fontWeight: 600,
									padding: '2px 7px',
									borderRadius: '6px',
									background:
										member.status === 'active'
											? 'rgba(52, 199, 89, 0.15)'
											: member.status === 'alumni'
											? 'rgba(10, 132, 255, 0.15)'
											: member.status === 'pending'
											? 'rgba(255, 204, 0, 0.15)'
											: 'rgba(255, 59, 48, 0.15)',
									color:
										member.status === 'active'
											? '#34c759'
											: member.status === 'alumni'
											? '#0a84ff'
											: member.status === 'pending'
											? '#ffcc00'
											: '#ff3b30',
								}}
							>
								{member.status === 'active' && <CheckCircle2 size={11} />}
								{member.status === 'pending' && <Clock size={11} />}
								{member.status === 'rejected' && <XCircle size={11} />}
								{member.status === 'alumni' && <GraduationCap size={11} />}
								{member.status === 'active'
									? t('membersStatusActive', 'Aktif')
									: member.status === 'pending'
									? t('membersStatusPending', 'Onay Bekliyor')
									: member.status === 'alumni'
									? t('membersStatusAlumni', 'Mezun')
									: t('membersStatusRejected', 'Reddedildi')}
							</span>
						</div>
					</div>
				</div>

				{/* Detailed Grid Info */}
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
					<div
						style={{
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<BookOpen size={12} />
							<span>{t('membersDeptClassLabel')}</span>
						</div>
						<div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '4px' }}>
							{member.department}
						</div>
						<div style={{ fontSize: '11.5px', opacity: 0.7 }}>
							{fill(t('membersClassYear'), { year: member.grade })}
						</div>
					</div>

					<div
						style={{
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Hash size={12} />
							<span>{t('membersStudentIdLabel')}</span>
						</div>
						<div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
							{member.handle || member.studentNo || '—'}
						</div>
					</div>

					<div
						style={{
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Calendar size={12} />
							<span>{t('membersAttendanceLabel', 'Attendance Katılımı')}</span>
						</div>
						<div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
							{member.attendanceCount ?? 0} {t('eventsAttendanceUnit', 'CommunityEvent')}
						</div>
					</div>

					<div
						style={{
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Award size={12} color="#ff9500" />
							<span>{t('membersXpLabel')}</span>
						</div>
						<div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px', color: '#ff9500' }}>
							{member.xp || 0} XP
						</div>
					</div>

					<div
						style={{
							gridColumn: '1 / -1',
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<HardDrive size={12} color="var(--accent)" />
							<span>{t('membersColStorage', 'Depolama')}</span>
						</div>
						<div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
							{formatBytes(member.diskUsageBytes)}
							<span style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'normal', marginLeft: '6px' }}>
								({member.fileCount ?? 0} {t('filesCountUnit', 'dosya')})
							</span>
						</div>
					</div>
				</div>

				{/* Associated Teams Section */}
				{memberTeams.length > 0 ? (
					<div
						style={{
							padding: '12px 14px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '10px',
							border: '1px solid var(--window-border)',
							display: 'flex',
							flexDirection: 'column',
							gap: '8px',
						}}
					>
						<div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Users size={12} color="var(--accent)" />
							<span>{t('membersConnectedTeams', 'Bağlı Olduğu Ar-Ge Takımları')}</span>
							<span style={{ marginLeft: 'auto', background: 'var(--fill-soft)', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>
								{memberTeams.length}
							</span>
						</div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
							{memberTeams.map((tm) => (
								<div
									key={tm.id}
									style={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: '6px',
										padding: '6px 10px',
										background: 'var(--card-bg, rgba(255, 255, 255, 0.06))',
										border: '1px solid var(--window-border)',
										borderRadius: '8px',
										fontSize: '12px',
									}}
								>
									<span style={{ fontWeight: 600 }}>{tm.name}</span>
									{tm.isLeader && (
										<span
											style={{
												fontSize: '10px',
												fontWeight: 700,
												color: '#ff9500',
												background: 'rgba(255, 149, 0, 0.15)',
												padding: '1px 5px',
												borderRadius: '4px',
											}}
										>
											👑 {t('teamRoleCaptain')}
										</span>
									)}
									{tm.role && !tm.isLeader && (
										<span style={{ fontSize: '11px', opacity: 0.7 }}>({tm.role})</span>
									)}
									{tm.category && (
										<span style={{ fontSize: '10px', opacity: 0.5, borderLeft: '1px solid var(--border-subtle)', paddingLeft: '5px' }}>
											{tm.category}
										</span>
									)}
								</div>
							))}
						</div>
					</div>
				) : member.teamName ? (
					<div
						style={{
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Users size={12} color="var(--accent)" />
							<span>{t('membersConnectedTeams', 'Bağlı Olduğu Ar-Ge Takımları')}</span>
						</div>
						<div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '4px' }}>
							{member.teamName}
						</div>
					</div>
				) : (
					<div
						style={{
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Users size={12} />
							<span>{t('membersConnectedTeams', 'Bağlı Olduğu Ar-Ge Takımları')}</span>
						</div>
						<div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
							{t('membersNotAssigned', 'Henüz bir takıma atanmamış')}
						</div>
					</div>
				)}

				{(() => {
					const effectiveCustomFields = adminData?.customFields ?? member.customFields ?? {};
					const effectiveFields = adminData?.fields && adminData.fields.length > 0 ? adminData.fields : memberFields;
					if (!effectiveCustomFields || Object.keys(effectiveCustomFields).length === 0) return null;
					return (
						<div
							style={{
								padding: '10px 12px',
								background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
								borderRadius: '8px',
								border: '1px solid var(--window-border)',
								display: 'flex',
								flexDirection: 'column',
								gap: '8px',
							}}
						>
							<div style={{ fontSize: '11px', opacity: 0.6 }}>{t('membersAdditionalFields')}</div>
							{Object.entries(effectiveCustomFields).map(([key, value]) => {
								const definition = effectiveFields.find((field) => field.fieldKey === key);
								let displayValue = value;
								if (definition?.type === 'select' && definition.options?.length) {
									const opt = definition.options.find((o) => o.value === value);
									if (opt) displayValue = optionLabel(opt, language);
								}
								const isHidden = definition?.directoryVisibility === 'hidden';
								const isManagersOnly = definition?.directoryVisibility === 'managers';
								return (
									<div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
										<span style={{ opacity: 0.75, display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
											<span>{definition ? fieldLabel(definition, language) : key}</span>
											{canEdit && isHidden && (
												<span
													style={{
														fontSize: '10px',
														padding: '1px 6px',
														borderRadius: '4px',
														background: 'rgba(239, 68, 68, 0.15)',
														color: 'var(--red-light, #fca5a5)',
														fontWeight: 500,
														display: 'inline-flex',
														alignItems: 'center',
														gap: '3px',
													}}
													title={t('formVisibilityHiddenAdminTooltip', 'Bu alan genel üye profilinde gizlidir, yalnızca yöneticiler görebilir.')}
												>
													🔒 {t('formVisibilityHiddenAdmin', 'Gizli (Yönetici)')}
												</span>
											)}
											{canEdit && isManagersOnly && (
												<span
													style={{
														fontSize: '10px',
														padding: '1px 6px',
														borderRadius: '4px',
														background: 'rgba(245, 158, 11, 0.15)',
														color: 'var(--amber-light, #fcd34d)',
														fontWeight: 500,
														display: 'inline-flex',
														alignItems: 'center',
														gap: '3px',
													}}
													title={t('formVisibilityManagersTooltip', 'Bu alan yalnızca yöneticilere açıktır.')}
												>
													🔒 {t('formDirectory_managers', 'Yalnız yöneticiler')}
												</span>
											)}
										</span>
										<span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{displayValue}</span>
									</div>
								);
							})}
						</div>
					);
				})()}

				{/* Bio if present */}
				{member.bio && (
					<div
						style={{
							padding: '10px 12px',
							background: 'var(--fill-soft, rgba(255, 255, 255, 0.04))',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6 }}>{t('membersAboutLabel')}</div>
						<div style={{ fontSize: '12px', marginTop: '4px', lineHeight: 1.4, opacity: 0.85 }}>
							{member.bio}
						</div>
					</div>
				)}

				{/* Registration Date */}
				{joinDate && (
					<div style={{ fontSize: '11px', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '6px' }}>
						<Calendar size={12} />
						<span>{t('membersJoinDateLabel')}: {joinDate}</span>
					</div>
				)}

				{/* Footer buttons */}
				<div className={ui.btnRow} style={{ marginTop: '8px' }}>
					{canMessage && onSendMessage && (
						<button
							type="button"
							className={ui.btn}
							onClick={() => {
								onClose();
								onSendMessage(member.id);
							}}
							style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
						>
							<Mail size={14} />
							{fill(t('membersSendMessageTo'), { name: member.firstName })}
						</button>
					)}
					{canEdit && (
						<button
							type="button"
							className={ui.btn}
							onClick={() => setEditOpen(true)}
							style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
						>
							<Pencil size={14} />
							{t('edit')}
						</button>
					)}
					{canEdit && onSendPasswordReset && member.status === 'active' && (
						<button
							type="button"
							className={ui.btn}
							onClick={onSendPasswordReset}
							style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
						>
							<KeyRound size={14} />
							{t('membersSendResetEmail')}
						</button>
					)}
					<button type="button" className={ui.primaryBtn} onClick={onClose}>
						{t('close')}
					</button>
				</div>
			</div>
		</Sheet>
	);
}
