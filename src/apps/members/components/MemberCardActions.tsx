'use client';

import React from 'react';
import { Mail, Award, User, KeyRound, ShieldAlert, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { MemberRecord } from '../types';

interface MemberCardActionsProps {
	member: MemberRecord;
	isSelf: boolean;
	mailUser: boolean;
	canManage: boolean;
	canSoc: boolean;
	onOpenProfile: (member: MemberRecord) => void;
	onResetPassword: (memberId: string, name: string) => void;
	onSendMessage: (memberId: string) => void;
	onAwardXp: (memberId: string, xp: number) => void;
	onDelete: (memberId: string, name: string) => void;
	onOpenSoc: (memberId: string) => void;
}

const baseBtnStyle: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '5px',
	fontSize: '11.5px',
	minHeight: '44px',
	minWidth: '44px',
	borderRadius: '8px',
	cursor: 'pointer',
};

const softBtnStyle: React.CSSProperties = {
	...baseBtnStyle,
	padding: '0 12px',
	background: 'var(--fill-soft, rgba(255, 255, 255, 0.08))',
	color: 'var(--text-primary)',
	border: '1px solid var(--window-border, rgba(255, 255, 255, 0.12))',
	fontWeight: 500,
};

export function MemberCardActions({
	member,
	isSelf,
	mailUser,
	canManage,
	canSoc,
	onOpenProfile,
	onResetPassword,
	onSendMessage,
	onAwardXp,
	onDelete,
	onOpenSoc,
}: MemberCardActionsProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
			{mailUser && !isSelf && member.status === 'active' && (
				<button
					type="button"
					onClick={() => onSendMessage(member.id)}
					style={{
						...baseBtnStyle,
						padding: '0 12px',
						background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
						color: 'var(--accent)',
						border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
						fontWeight: 600,
					}}
				>
					<Mail size={13} />
					<span>{t('membersCardMessage')}</span>
				</button>
			)}

			<button type="button" onClick={() => onOpenProfile(member)} style={softBtnStyle}>
				<User size={13} />
				<span>{t('membersCardProfile')}</span>
			</button>

			{canManage && (
				<>
					<button
						type="button"
						onClick={() => onAwardXp(member.id, 25)}
						style={{
							...baseBtnStyle,
							padding: '0 12px',
							background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
							color: '#e5a50a',
							border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)',
							fontWeight: 600,
						}}
					>
						<Award size={13} />
						<span>{fill(t('membersCardAwardXp', '+{amount} XP'), { amount: 25 })}</span>
					</button>

					<button
						type="button"
						onClick={() => onResetPassword(member.id, `${member.firstName} ${member.lastName}`)}
						style={{ ...softBtnStyle, padding: '0 10px' }}
						title={t('membersCtxResetPassword')}
						aria-label={t('membersCtxResetPassword')}
					>
						<KeyRound size={14} />
					</button>

					{canSoc && (
						<button
							type="button"
							onClick={() => onOpenSoc(member.id)}
							style={softBtnStyle}
							title={t('membersCtxSocAudit')}
							aria-label={t('membersCtxSocAudit')}
						>
							<ShieldAlert size={13} />
							<span>{t('membersCardSoc', 'SOC')}</span>
						</button>
					)}

					{!isSelf && (
						<button
							type="button"
							onClick={() => onDelete(member.id, `${member.firstName} ${member.lastName}`)}
							style={{
								...baseBtnStyle,
								padding: '0 10px',
								background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
								color: 'var(--danger)',
								border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
								fontWeight: 500,
							}}
							title={t('membersCtxDelete')}
							aria-label={t('membersCtxDelete')}
						>
							<Trash2 size={14} />
						</button>
					)}
				</>
			)}
		</div>
	);
}
