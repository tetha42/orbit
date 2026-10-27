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
} from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { AvatarFallback } from '@/components/Common/AvatarFallback';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { isMezunRol } from '@/core/permissions';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';
import type { MemberRecord } from '../types';

interface MemberDetailModalProps {
	member: MemberRecord | null;
	isOpen: boolean;
	onClose: () => void;
	currentUserId?: string;
	mailUser: boolean;
	isReachable: boolean;
	onSendMessage?: (memberId: string) => void;
}

export function MemberDetailModal({
	member,
	isOpen,
	onClose,
	currentUserId,
	mailUser,
	isReachable: _isReachable,
	onSendMessage,
}: MemberDetailModalProps) {
	const { t, language } = useI18n();

	if (!isOpen || !member) return null;

	const isSelf = member.id === currentUserId;
	const canMessage = mailUser && !isSelf && member.status === 'aktif';
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
	const joinDate = member.olusturma
		? new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
		  }).format(new Date(member.olusturma))
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
						background: 'rgba(255, 255, 255, 0.04)',
						borderRadius: '12px',
						border: '1px solid var(--window-border)',
					}}
				>
					{member.profilFoto ? (
						<Image
							src={member.profilFoto}
							alt={`${member.ad} ${member.soyad}`}
							width={54}
							height={54}
							unoptimized
							style={{ width: '54px', height: '54px', borderRadius: '50%', objectFit: 'cover' }}
						/>
					) : (
						<AvatarFallback name={`${member.ad} ${member.soyad}`} size={54} />
					)}
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
							{member.ad} {member.soyad}
						</div>
						<div style={{ fontSize: '12.5px', opacity: 0.7, wordBreak: 'break-all' }}>
							{member.email}
						</div>
						<div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
							<RoleBadge
								role={displayRol}
								bosMetin={t('roleNone')}
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
								{member.status === 'aktif' && <CheckCircle2 size={11} />}
								{member.status === 'beklemede' && <Clock size={11} />}
								{member.status === 'reddedildi' && <XCircle size={11} />}
								{member.status === 'mezun' && <GraduationCap size={11} />}
								{member.status === 'aktif'
									? t('membersStatusActive', 'Aktif')
									: member.status === 'beklemede'
									? t('membersStatusPending', 'Onay Bekliyor')
									: member.status === 'mezun'
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
							background: 'rgba(255, 255, 255, 0.03)',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<BookOpen size={12} />
							<span>{t('membersDeptClassLabel')}</span>
						</div>
						<div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '4px' }}>
							{member.bolum}
						</div>
						<div style={{ fontSize: '11.5px', opacity: 0.7 }}>
							{fill(t('membersClassYear'), { year: member.sinif })}
						</div>
					</div>

					<div
						style={{
							padding: '10px 12px',
							background: 'rgba(255, 255, 255, 0.03)',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Hash size={12} />
							<span>{t('membersStudentIdLabel')}</span>
						</div>
						<div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
							{member.ogrenciNo || '—'}
						</div>
					</div>

					<div
						style={{
							padding: '10px 12px',
							background: 'rgba(255, 255, 255, 0.03)',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Calendar size={12} />
							<span>{t('membersAttendanceLabel', 'Attendance Katılımı')}</span>
						</div>
						<div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
							{member.yoklamaSayisi ?? 0} {t('eventsAttendanceUnit', 'CommunityEvent')}
						</div>
					</div>

					<div
						style={{
							padding: '10px 12px',
							background: 'rgba(255, 255, 255, 0.03)',
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
				</div>

				{/* Associated Teams Section */}
				{member.takimlar && member.takimlar.length > 0 ? (
					<div
						style={{
							padding: '12px 14px',
							background: 'rgba(255, 255, 255, 0.03)',
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
								{member.takimlar.length}
							</span>
						</div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
							{member.takimlar.map((tm) => (
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
									<span style={{ fontWeight: 600 }}>{tm.ad}</span>
									{tm.liderMi && (
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
									{tm.role && !tm.liderMi && (
										<span style={{ fontSize: '11px', opacity: 0.7 }}>({tm.role})</span>
									)}
									{tm.kategori && (
										<span style={{ fontSize: '10px', opacity: 0.5, borderLeft: '1px solid var(--border-subtle)', paddingLeft: '5px' }}>
											{tm.kategori}
										</span>
									)}
								</div>
							))}
						</div>
					</div>
				) : member.takimAdi ? (
					<div
						style={{
							padding: '10px 12px',
							background: 'rgba(255, 255, 255, 0.03)',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Users size={12} color="var(--accent)" />
							<span>{t('membersConnectedTeams', 'Bağlı Olduğu Ar-Ge Takımları')}</span>
						</div>
						<div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '4px' }}>
							{member.takimAdi}
						</div>
					</div>
				) : (
					<div
						style={{
							padding: '10px 12px',
							background: 'rgba(255, 255, 255, 0.02)',
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

				{/* Bio if present */}
				{member.bio && (
					<div
						style={{
							padding: '10px 12px',
							background: 'rgba(255, 255, 255, 0.03)',
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
							{fill(t('membersSendMessageTo'), { name: member.ad })}
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
