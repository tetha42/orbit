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
	Shield,
	ShieldAlert,
	Trash2,
} from 'lucide-react';
import { AvatarFallback } from '@/components/Common/AvatarFallback';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { isMezunRol } from '@/core/permissions';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useContextMenu, useShellActions } from '@/core/shell';
import { useWindowActions } from '@/core/windows';
import type { MenuItem } from '@/types/workspace';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';
import { MemberActions } from './MemberActions';
import type { MemberRecord, AtanabilirRol } from '../types';

interface MemberRowProps {
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

export function MemberRow({
	member,
	currentUserId,
	mailUser,
	isReachable,
	isAuthorizedToAdd,
	erisilebilir,
	atanabilir,
	onOpenProfile,
	onResetPassword,
	onSendMessage,
	onUpdateStatus,
	onUpdateRole,
	onAwardXp,
	onDelete,
}: MemberRowProps) {
	const { t } = useI18n();
	const { canUseApp } = useSession();
	const { openContextMenu } = useShellActions();
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

	const buildMenuItems = (): MenuItem[] => {
		const isSelf = member.id === currentUserId;
		const canManage = erisilebilir && isAuthorizedToAdd;

		const items: MenuItem[] = [
			{
				id: `view-profile-${member.id}`,
				label: t('membersCtxViewProfile'),
				icon: <User size={14} />,
				action: () => onOpenProfile(member),
			},
		];

		if (mailUser && !isSelf && member.status === 'aktif' && isReachable) {
			items.push({
				id: `send-mail-${member.id}`,
				label: t('membersCtxSendMessage'),
				icon: <Mail size={14} />,
				action: () => onSendMessage(member.id),
			});
		}

		if (canManage) {
			items.push({ id: `sep-mgm-${member.id}`, label: '', separator: true });

			if (canSoc) {
				items.push({
					id: `soc-audit-${member.id}`,
					label: t('membersCtxSocAudit'),
					icon: <ShieldAlert size={14} />,
					action: () => openApp('soc', { section: 'siem', kind: 'user', itemId: member.id }),
				});
			}

			if (member.status !== 'reddedildi') {
				items.push({
					id: `change-role-${member.id}`,
					label: t('membersCtxChangeRole'),
					icon: <Shield size={14} />,
					children: [
						{
							id: `role-none-${member.id}`,
							label: t('membersCtxNoRole'),
							checked: !member.roleId && !isMezun,
							action: () => onUpdateRole(member.id, ''),
						},
						...atanabilir.map((r) => ({
							id: `role-${r.id}-${member.id}`,
							label: isMezunRol(r) ? t('membersStatusAlumni', r.ad) : r.ad,
							checked: isMezun ? isMezunRol(r) : member.roleId === r.id,
							action: () => onUpdateRole(member.id, r.id),
						})),
					],
				});
			}

			items.push({
				id: `reset-pwd-${member.id}`,
				label: t('membersCtxResetPassword'),
				icon: <KeyRound size={14} />,
				action: () => onResetPassword(member.id, `${member.ad} ${member.soyad}`),
			});

			if (member.status === 'beklemede') {
				items.push({
					id: `approve-${member.id}`,
					label: t('membersCtxApprove'),
					icon: <CheckCircle2 size={14} />,
					action: () => onUpdateStatus(member.id, 'aktif'),
				});
				items.push({
					id: `reject-${member.id}`,
					label: t('membersCtxReject'),
					icon: <XCircle size={14} />,
					action: () => onUpdateStatus(member.id, 'reddedildi'),
				});
			}

			items.push({
				id: `award-xp-${member.id}`,
				label: t('membersCtxAwardXp'),
				icon: <Award size={14} />,
				action: () => onAwardXp(member.id, 50),
			});

			if (!isSelf) {
				items.push({ id: `sep-del-${member.id}`, label: '', separator: true });
				items.push({
					id: `delete-${member.id}`,
					label: t('membersCtxDelete'),
					icon: <Trash2 size={14} />,
					action: () => onDelete(member.id, `${member.ad} ${member.soyad}`),
				});
			}
		}

		return items;
	};

	const rowContextMenuProps = useContextMenu({
		items: buildMenuItems,
	});

	const handleActionMenuClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		openContextMenu({
			x: rect.left,
			y: rect.bottom + 4,
			mode: 'app',
			appId: 'members',
			customItems: buildMenuItems(),
		});
	};

	return (
		<tr
			data-focus-id={`member:${member.id}`}
			data-member-row={member.id}
			{...rowContextMenuProps}
			onDoubleClick={() => onOpenProfile(member)}
			title={t('membersRowContextTitle')}
			style={{
				borderBottom: '1px solid rgba(120, 120, 130, 0.08)',
				transition: 'background 120ms ease',
				cursor: 'context-menu',
			}}
		>
			{/* Name & Avatar */}
			<td style={{ padding: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					{member.profilFoto ? (
						<Image
							src={member.profilFoto}
							alt={`${member.ad} ${member.soyad}`}
							width={34}
							height={34}
							unoptimized
							style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
						/>
					) : (
						<AvatarFallback name={`${member.ad} ${member.soyad}`} size={34} />
					)}
					<div>
						<div style={{ fontWeight: 600 }}>
							{member.ad} {member.soyad}
						</div>
						<div style={{ fontSize: '11px', opacity: 0.6 }}>{member.email}</div>
					</div>
					{mailUser && member.id !== currentUserId && member.status === 'aktif' && isReachable && (
						<button
							type="button"
							className={ui.btn}
							data-member-message={member.id}
							title={fill(t('membersSendMessageTo'), { name: `${member.ad} ${member.soyad}` })}
							aria-label={fill(t('membersSendMessageTo'), { name: `${member.ad} ${member.soyad}` })}
							onClick={() => onSendMessage(member.id)}
							style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', fontSize: 11.5 }}
						>
							<Mail size={13} />
							{t('membersSendMessage')}
						</button>
					)}
				</div>
			</td>

			{/* Role badge */}
			<td style={{ padding: '10px' }}>
				<RoleBadge role={displayRol} bosMetin={t('roleNone')} />
			</td>

			{/* Major & Year */}
			<td style={{ padding: '10px' }}>
				<div>{member.bolum}</div>
				<div style={{ fontSize: '11px', opacity: 0.6 }}>
					{fill(t('membersClassAndNo'), { year: member.sinif, no: member.ogrenciNo || '-' })}
				</div>
			</td>

			{/* Team */}
			<td style={{ padding: '10px' }}>
				<div style={{ fontSize: '12.5px', fontWeight: 500 }}>
					{member.takimAdi || <span style={{ opacity: 0.4 }}>{t('membersNotAssigned')}</span>}
				</div>
			</td>

			{/* XP */}
			<td style={{ padding: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<Award size={14} style={{ color: '#ff9500' }} />
					<span style={{ fontWeight: 600, fontSize: '12px' }}>{member.xp || 0} XP</span>
				</div>
			</td>

			{/* Status */}
			<td style={{ padding: '10px' }}>
				<span
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '4px',
						fontSize: '11px',
						fontWeight: 600,
						padding: '2px 8px',
						borderRadius: '6px',
						background:
							member.status === 'aktif'
								? 'rgba(52, 199, 89, 0.15)'
								: member.status === 'mezun'
								? 'rgba(10, 132, 255, 0.15)'
								: member.status === 'beklemede'
								? 'rgba(255, 204, 0, 0.15)'
								: 'rgba(255, 59, 48, 0.15)',
						color:
							member.status === 'aktif'
								? '#34c759'
								: member.status === 'mezun'
								? '#0a84ff'
								: member.status === 'beklemede'
								? '#ffcc00'
								: '#ff3b30',
					}}
				>
					{member.status === 'aktif' && <CheckCircle2 size={12} />}
					{member.status === 'beklemede' && <Clock size={12} />}
					{member.status === 'reddedildi' && <XCircle size={12} />}
					{member.status === 'mezun' && <GraduationCap size={12} />}
					{member.status === 'aktif'
						? t('membersStatusActive', 'Aktif')
						: member.status === 'beklemede'
						? t('membersStatusPending', 'Onay Bekliyor')
						: member.status === 'mezun'
						? t('membersStatusAlumni', 'Mezun')
						: t('membersStatusRejected', 'Reddedildi')}
				</span>
			</td>

			{/* Management Actions */}
			{isAuthorizedToAdd && (
				<td style={{ padding: '10px', textAlign: 'center' }}>
					<div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
						{canSoc && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									openApp('soc', { section: 'siem', kind: 'user', itemId: member.id });
								}}
								title={t('membersCtxSocAudit')}
								style={{
									background: 'transparent',
									border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
									color: 'var(--text-secondary)',
									cursor: 'pointer',
									padding: '4px 6px',
									borderRadius: '6px',
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<ShieldAlert size={13} />
							</button>
						)}
						<MemberActions
							member={member}
							onUpdateStatus={onUpdateStatus}
							onOpenContextMenu={handleActionMenuClick}
						/>
					</div>
				</td>
			)}
		</tr>
	);
}
