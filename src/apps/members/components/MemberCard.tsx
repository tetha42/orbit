'use client';

import React from 'react';
import Image from 'next/image';
import {
	Mail,
	Award,
	CheckCircle2,
	Clock,
	XCircle,
	GraduationCap,
	User,
	KeyRound,
	ShieldAlert,
	Trash2,
	ChevronRight,
} from 'lucide-react';
import { AvatarFallback } from '@/components/Common/AvatarFallback';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { isMezunRol } from '@/core/permissions';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useWindowActions } from '@/core/windows';
import { fill } from '@/lib/text';
import type { MemberRecord, AtanabilirRol } from '../types';

interface MemberCardProps {
	member: MemberRecord;
	currentUserId?: string;
	mailUser: boolean;
	isReachable: boolean;
	isAuthorizedToAdd: boolean;
	erisilebilir: boolean;
	atanabilir: AtanabilirRol[];
	onOpenProfile: (member: MemberRecord) => void;
	onResetPassword: (memberId: string, name: string) => void;
	onSendMessage: (memberId: string) => void;
	onUpdateStatus: (memberId: string, status: 'aktif' | 'reddedildi' | 'mezun') => void;
	onUpdateRole: (memberId: string, roleId: string) => void;
	onAwardXp: (memberId: string, xp: number) => void;
	onDelete: (memberId: string, name: string) => void;
}

export function MemberCard({
	member,
	currentUserId,
	mailUser,
	isReachable: _isReachable,
	isAuthorizedToAdd,
	erisilebilir,
	atanabilir: _atanabilir,
	onOpenProfile,
	onResetPassword,
	onSendMessage,
	onUpdateStatus: _onUpdateStatus,
	onUpdateRole: _onUpdateRole,
	onAwardXp,
	onDelete,
}: MemberCardProps) {
	const { t } = useI18n();
	const { canUseApp } = useSession();
	const { openApp } = useWindowActions();
	const canSoc = canUseApp('soc');

	const isMezun = member.status === 'mezun' || isMezunRol({ id: member.roleId, ad: member.rolAd });
	const displayRol = isMezun
		? {
				ad: isMezunRol({ id: member.roleId, ad: member.rolAd })
					? (member.rolAd ?? t('membersStatusAlumni', 'Mezun'))
					: t('membersStatusAlumni', 'Mezun'),
				renk: isMezunRol({ id: member.roleId, ad: member.rolAd }) ? (member.rolRenk ?? '#64d2ff') : '#64d2ff',
		  }
		: member.roleId
		? { ad: member.rolAd ?? '—', renk: member.rolRenk ?? '#8e8e93' }
		: null;

	const isSelf = member.id === currentUserId;
	const canManage = erisilebilir && isAuthorizedToAdd;

	return (
		<div
			className="cv-auto-card"
			data-focus-id={`member:${member.id}`}
			style={{
				background: 'var(--card-bg)',
				border: '1px solid var(--card-border)',
				borderRadius: '12px',
				padding: '12px 14px',
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
				boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
			}}
		>
			{/* Top Header: Avatar + Name + Status / Role */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
					<div
						style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0, cursor: 'pointer' }}
						onClick={() => onOpenProfile(member)}
					>
						{member.profilFoto ? (
							<Image
								src={member.profilFoto}
								alt={`${member.ad} ${member.soyad}`}
								width={36}
								height={36}
								style={{ borderRadius: '50%', objectFit: 'cover' }}
								unoptimized
							/>
						) : (
							<AvatarFallback name={`${member.ad} ${member.soyad}`} size={36} />
						)}
					</div>

					<div style={{ minWidth: 0 }}>
						<button
							type="button"
							onClick={() => onOpenProfile(member)}
							style={{
								fontWeight: 700,
								fontSize: '14px',
								color: 'var(--text-primary)',
								background: 'none',
								border: 'none',
								padding: 0,
								cursor: 'pointer',
								textAlign: 'left',
								display: 'flex',
								alignItems: 'center',
								gap: '4px',
							}}
						>
							<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
								{member.ad} {member.soyad}
							</span>
							<ChevronRight size={13} style={{ opacity: 0.5 }} />
						</button>
						<div
							style={{
								fontSize: '11px',
								color: 'var(--text-secondary)',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{member.email}
						</div>
					</div>
				</div>

				{/* Role or Status Badge */}
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
					<RoleBadge role={displayRol} bosMetin={t('roleNone')} size="sm" />

					<span
						style={{
							fontSize: '10.5px',
							fontWeight: 650,
							display: 'inline-flex',
							alignItems: 'center',
							gap: '3px',
							color:
								member.status === 'aktif'
									? 'var(--success)'
									: member.status === 'beklemede'
									? 'var(--warning)'
									: member.status === 'mezun'
									? '#64d2ff'
									: 'var(--danger)',
						}}
					>
						{member.status === 'aktif' && <CheckCircle2 size={11} />}
						{member.status === 'beklemede' && <Clock size={11} />}
						{member.status === 'mezun' && <GraduationCap size={11} />}
						{member.status === 'reddedildi' && <XCircle size={11} />}
						{member.status === 'aktif'
							? t('statusActive', 'Aktif')
							: member.status === 'beklemede'
							? t('statusPending', 'Bekliyor')
							: member.status === 'mezun'
							? t('membersStatusAlumni', 'Mezun')
							: t('statusRejected', 'Red')}
					</span>
				</div>
			</div>

			{/* Meta Row: Dept, Class, Team, XP */}
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(2, 1fr)',
					gap: '6px 12px',
					fontSize: '11.5px',
					background: 'rgba(0, 0, 0, 0.03)',
					padding: '8px 10px',
					borderRadius: '8px',
				}}
			>
				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersDeptClassLabel')}</span>
					<span style={{ fontWeight: 550 }}>
						{member.bolum || '—'} {member.sinif ? `(${fill(t('certsGradeFormat'), { grade: member.sinif })})` : ''}
					</span>
				</div>

				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersTeamProjectLabel')}</span>
					<span style={{ fontWeight: 550 }}>
						{member.takimAdi || '—'}
					</span>
				</div>

				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersStudentIdLabel')}</span>
					<span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>
						{member.ogrenciNo || '—'}
					</span>
				</div>

				<div>
					<span style={{ opacity: 0.6, fontSize: '10.5px', display: 'block' }}>{t('membersXpPointsLabel')}</span>
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: 'var(--warning)' }}>
						<Award size={12} />
						{member.xp ?? 0} XP
					</span>
				</div>
			</div>

			{/* Actions Row */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
				{mailUser && !isSelf && member.status === 'aktif' && (
					<button
						type="button"
						onClick={() => onSendMessage(member.id)}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							fontSize: '11px',
							padding: '4px 8px',
							borderRadius: '6px',
							background: 'rgba(0, 122, 255, 0.1)',
							color: 'var(--accent)',
							border: '1px solid rgba(0, 122, 255, 0.2)',
							cursor: 'pointer',
							fontWeight: 600,
						}}
					>
						<Mail size={12} />
						<span>Mesaj</span>
					</button>
				)}

				<button
					type="button"
					onClick={() => onOpenProfile(member)}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '4px',
						fontSize: '11px',
						padding: '4px 8px',
						borderRadius: '6px',
						background: 'rgba(255, 255, 255, 0.08)',
						color: 'var(--text-primary)',
						border: '1px solid rgba(255, 255, 255, 0.12)',
						cursor: 'pointer',
						fontWeight: 500,
					}}
				>
					<User size={12} />
					<span>Profil</span>
				</button>

				{canManage && (
					<>
						<button
							type="button"
							onClick={() => onAwardXp(member.id, 25)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
								fontSize: '11px',
								padding: '4px 8px',
								borderRadius: '6px',
								background: 'rgba(255, 189, 46, 0.12)',
								color: '#e5a50a',
								border: '1px solid rgba(255, 189, 46, 0.25)',
								cursor: 'pointer',
								fontWeight: 600,
							}}
						>
							<Award size={12} />
							<span>+25 XP</span>
						</button>

						<button
							type="button"
							onClick={() => onResetPassword(member.id, `${member.ad} ${member.soyad}`)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
								fontSize: '11px',
								padding: '4px 8px',
								borderRadius: '6px',
								background: 'rgba(255, 255, 255, 0.08)',
								color: 'var(--text-primary)',
								border: '1px solid rgba(255, 255, 255, 0.12)',
								cursor: 'pointer',
								fontWeight: 500,
							}}
							title={t('membersCtxResetPassword')}
						>
							<KeyRound size={12} />
						</button>

						{canSoc && (
							<button
								type="button"
								onClick={() => openApp('soc', { section: 'siem', kind: 'user', itemId: member.id })}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '4px',
									fontSize: '11px',
									padding: '4px 8px',
									borderRadius: '6px',
									background: 'rgba(255, 255, 255, 0.08)',
									color: 'var(--text-primary)',
									border: '1px solid rgba(255, 255, 255, 0.12)',
									cursor: 'pointer',
									fontWeight: 500,
								}}
								title={t('membersCtxSocAudit')}
							>
								<ShieldAlert size={12} />
								<span>SOC</span>
							</button>
						)}

						{!isSelf && (
							<button
								type="button"
								onClick={() => onDelete(member.id, `${member.ad} ${member.soyad}`)}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '4px',
									fontSize: '11px',
									padding: '4px 8px',
									borderRadius: '6px',
									background: 'rgba(215, 0, 21, 0.1)',
									color: 'var(--danger)',
									border: '1px solid rgba(215, 0, 21, 0.2)',
									cursor: 'pointer',
									fontWeight: 500,
								}}
								title={t('membersCtxDelete')}
							>
								<Trash2 size={12} />
							</button>
						)}
					</>
				)}
			</div>
		</div>
	);
}
