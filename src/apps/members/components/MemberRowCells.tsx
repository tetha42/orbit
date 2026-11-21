'use client';

import Image from 'next/image';
import { Mail, CheckCircle2, Clock, XCircle, GraduationCap } from 'lucide-react';
import { AvatarFallback } from '@/components/Common/AvatarFallback';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import ui from '@/core/ui/ui.module.css';
import { getMemberStatusLabel } from './MemberDisplayUtils';
import type { MemberRecord } from '../types';

export function MemberIdentityCell({
	member,
	currentUserId,
	mailUser,
	isReachable,
	onSendMessage,
}: {
	member: MemberRecord;
	currentUserId?: string;
	mailUser: boolean;
	isReachable: boolean;
	onSendMessage: (memberId: string) => void;
}) {
	const { t } = useI18n();
	const fullName = `${member.firstName} ${member.lastName}`;
	const avatarSrc = member.avatarUrl || member.profilePhoto;

	return (
		<td style={{ padding: '10px' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
				{avatarSrc ? (
					<Image
						src={avatarSrc}
						alt={fullName}
						width={34}
						height={34}
						unoptimized
						style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
					/>
				) : (
					<AvatarFallback name={fullName} size={34} />
				)}
				<div>
					<div style={{ fontWeight: 600 }}>{fullName}</div>
					<div style={{ fontSize: '11px', opacity: 0.6 }}>{member.email}</div>
				</div>
				{mailUser && member.id !== currentUserId && member.status === 'active' && isReachable && (
					<button
						type="button"
						className={ui.btn}
						data-member-message={member.id}
						title={fill(t('membersSendMessageTo'), { name: fullName })}
						aria-label={fill(t('membersSendMessageTo'), { name: fullName })}
						onClick={() => onSendMessage(member.id)}
						style={{
							marginLeft: 'auto',
							display: 'inline-flex',
							alignItems: 'center',
							gap: 5,
							padding: '4px 9px',
							fontSize: 11.5,
						}}
					>
						<Mail size={13} />
						{t('membersSendMessage')}
					</button>
				)}
			</div>
		</td>
	);
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
	active: { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' },
	alumni: { bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' },
	pending: { bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' },
	rejected: { bg: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' },
};

export function MemberStatusCell({ status }: { status: MemberRecord['status'] }) {
	const { t } = useI18n();
	const style = STATUS_STYLE[status] ?? STATUS_STYLE.rejected;

	return (
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
					background: style.bg,
					color: style.color,
				}}
			>
				{status === 'active' && <CheckCircle2 size={12} />}
				{status === 'pending' && <Clock size={12} />}
				{status === 'rejected' && <XCircle size={12} />}
				{status === 'alumni' && <GraduationCap size={12} />}
				{getMemberStatusLabel(status, t)}
			</span>
		</td>
	);
}
