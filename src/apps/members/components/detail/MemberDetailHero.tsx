'use client';

import React from 'react';
import Image from 'next/image';
import { CheckCircle2, Clock, GraduationCap, XCircle } from 'lucide-react';
import { AvatarFallback } from '@/components/Common/AvatarFallback';
import { RoleBadge } from '@/core/ui/RoleBadge';
import { useI18n } from '@/core/i18n';
import { getMemberDisplayRole, getMemberStatusLabel } from '../MemberDisplayUtils';
import type { MemberRecord } from '../../types';

interface MemberDetailHeroProps {
	member: MemberRecord;
}

export function MemberDetailHero({ member }: MemberDetailHeroProps) {
	const { t } = useI18n();
	const displayRole = getMemberDisplayRole(member, t);
	const fullName = `${member.firstName} ${member.lastName}`;
	const avatarSrc = member.avatarUrl || member.profilePhoto;

	const statusColor =
		member.status === 'active'
			? 'var(--success)'
			: member.status === 'pending'
				? 'var(--warning)'
				: member.status === 'alumni'
					? '#64d2ff'
					: 'var(--danger)';

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '14px',
				paddingBottom: '14px',
				borderBottom: '1px solid var(--window-border)',
			}}
		>
			{avatarSrc ? (
				<Image
					src={avatarSrc}
					alt={fullName}
					width={54}
					height={54}
					unoptimized
					style={{
						width: '54px',
						height: '54px',
						borderRadius: '50%',
						objectFit: 'cover',
						flexShrink: 0,
					}}
				/>
			) : (
				<AvatarFallback name={fullName} size={54} />
			)}

			<div style={{ minWidth: 0, flex: 1 }}>
				<div style={{ fontSize: '16px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
					{fullName}
				</div>
				<div
					style={{
						fontSize: '12px',
						opacity: 0.7,
						marginTop: '2px',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
					}}
				>
					{member.email}
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
					<RoleBadge role={displayRole} emptyText={t('roleNone')} />
					<span
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							fontSize: '11px',
							fontWeight: 650,
							padding: '2px 8px',
							borderRadius: '999px',
							background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
							color: statusColor,
							border: `1px solid color-mix(in srgb, ${statusColor} 27%, transparent)`,
						}}
					>
						{member.status === 'active' && <CheckCircle2 size={11} />}
						{member.status === 'pending' && <Clock size={11} />}
						{member.status === 'alumni' && <GraduationCap size={11} />}
						{member.status === 'rejected' && <XCircle size={11} />}
						{getMemberStatusLabel(member.status, t)}
					</span>
				</div>
			</div>
		</div>
	);
}
