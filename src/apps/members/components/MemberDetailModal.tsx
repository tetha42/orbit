'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, KeyRound, Mail, Pencil, User } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import { fill } from '@/lib/text';
import type { FormField } from '@/lib/formFields';
import type { MemberRecord } from '../types';
import { MemberEditSheet } from './MemberEditSheet';
import { MemberDetailHero } from './detail/MemberDetailHero';
import { MemberDetailInfoGrid } from './detail/MemberDetailInfoGrid';
import { MemberDetailTeams } from './detail/MemberDetailTeams';
import { MemberDetailCustomFields } from './detail/MemberDetailCustomFields';

export interface MemberDetailModalProps {
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

interface AdminMemberDetail {
	customFields?: Record<string, string>;
	fields?: FormField[];
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
	const [memberFields, setMemberFields] = useState<FormField[]>([]);
	const [adminData, setAdminData] = useState<AdminMemberDetail | null>(null);
	const [editOpen, setEditOpen] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;
		const loadFields = async () => {
			try {
				const res = await fetch('/api/form-fields?scope=directory', { cache: 'no-store' });
				if (!res.ok) return;
				const data = await res.json();
				if (!cancelled && Array.isArray(data.fields)) {
					setMemberFields(data.fields);
				}
			} catch {
				// Ignore transient directory field load errors.
			}
		};
		void loadFields();
		return () => {
			cancelled = true;
		};
	}, [isOpen]);

	useEffect(() => {
		setEditOpen(false);
		if (!isOpen || !member?.id || !canEdit) {
			setAdminData(null);
			return;
		}
		let cancelled = false;
		const loadAdminDetail = async () => {
			try {
				const res = await fetch(`/api/members/${encodeURIComponent(member.id)}`, {
					cache: 'no-store',
				});
				if (!res.ok) return;
				const data = await res.json();
				if (!cancelled && data?.success) {
					setAdminData({
						customFields: data.customFields,
						fields: data.allFields || data.fields,
					});
				}
			} catch {
				// Ignore transient admin detail load errors.
			}
		};
		void loadAdminDetail();
		return () => {
			cancelled = true;
		};
	}, [canEdit, isOpen, member?.id]);

	if (!isOpen || !member) return null;

	if (editOpen) {
		return (
			<MemberEditSheet
				memberId={member.id}
				onClose={() => setEditOpen(false)}
				onSaved={() => {
					setEditOpen(false);
					onSaved?.();
					onClose();
				}}
			/>
		);
	}

	const joinDate = member.createdAt
		? new Intl.DateTimeFormat(language, {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			}).format(new Date(member.createdAt))
		: null;

	const effectiveCustomFields = adminData?.customFields ?? member.customFields ?? {};
	const effectiveFields = adminData?.fields?.length ? adminData.fields : memberFields;
	const canMessage = Boolean(
		mailUser && onSendMessage && member.id !== currentUserId && member.status === 'active',
	);

	return (
		<Sheet
			title={t('membersProfileTitle')}
			icon={<User size={20} color="var(--accent)" />}
			onClose={onClose}
			closeLabel={t('close')}
			maxWidth={480}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
				<MemberDetailHero member={member} />
				<MemberDetailInfoGrid member={member} />
				<MemberDetailTeams member={member} />
				<MemberDetailCustomFields
					fields={effectiveFields}
					customFields={effectiveCustomFields}
					canEdit={canEdit}
				/>

				{member.bio && (
					<div
						style={{
							padding: '10px 12px',
							borderRadius: '10px',
							background: 'rgba(255, 255, 255, 0.03)',
							border: '1px solid var(--window-border)',
							fontSize: '12.5px',
							lineHeight: 1.5,
						}}
					>
						<div style={{ fontSize: '11px', opacity: 0.65, marginBottom: '4px', fontWeight: 600 }}>
							{t('membersAboutLabel')}
						</div>
						<div style={{ whiteSpace: 'pre-wrap' }}>{member.bio}</div>
					</div>
				)}

				{joinDate && (
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.68 }}>
						<Calendar size={13} />
						<span>{t('membersJoinDateLabel')}: {joinDate}</span>
					</div>
				)}

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
