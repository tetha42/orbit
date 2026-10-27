'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { X, Users, UserPlus } from 'lucide-react';
import type { ChatOdaItem, ChatRoomMemberItem } from '../types';
import s from '../Chat.module.css';

interface GroupInfoModalProps {
	isOpen: boolean;
	onClose: () => void;
	room: ChatOdaItem;
	onOpenAddMembers: () => void;
}

export function GroupInfoModal({
	isOpen,
	onClose,
	room,
	onOpenAddMembers,
}: GroupInfoModalProps) {
	const { t } = useI18n();
	const [members, setMembers] = useState<ChatRoomMemberItem[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!isOpen) return;

		let isSubscribed = true;
		setLoading(true);

		void fetch(`/api/chat/rooms?action=members&odaId=${encodeURIComponent(room.id)}`)
			.then((res) => res.json())
			.then((data) => {
				if (isSubscribed && data.ok && Array.isArray(data.members)) {
					setMembers(data.members);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (isSubscribed) setLoading(false);
			});

		return () => {
			isSubscribed = false;
		};
	}, [isOpen, room.id]);

	if (!isOpen) return null;

	return (
		<div className={s.modalOverlay} onClick={onClose}>
			<div className={s.modalDialog} onClick={(e) => e.stopPropagation()}>
				{/* Modal Header */}
				<div className={s.modalHeader}>
					<div className={s.modalTitle}>
						<Users size={18} color="var(--accent)" />
						<span>{t('chatGroupInfo')}</span>
					</div>
					<button
						type="button"
						className={s.modalCloseBtn}
						onClick={onClose}
						title={t('close')}
					>
						<X size={16} />
					</button>
				</div>

				{/* Modal Body */}
				<div className={s.modalBody}>
					{/* Group Banner Info */}
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							padding: '16px 0',
							borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
							gap: '10px',
							textAlign: 'center',
						}}
					>
						<div
							style={{
								width: '64px',
								height: '64px',
								borderRadius: '50%',
								background: 'var(--accent-subtle)',
								border: '2px solid var(--accent-border)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'var(--accent)',
								fontSize: '24px',
								fontWeight: 700,
								overflow: 'hidden',
							}}
						>
							{room.avatar ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={room.avatar}
									alt={room.ad}
									style={{ width: '100%', height: '100%', objectFit: 'cover' }}
								/>
							) : (
								<Users size={28} />
							)}
						</div>

						<div>
							<div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
								{room.ad}
							</div>
							<div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
								{fill(t('chatTotalMembers'), { n: members.length || room.memberCount || 0 })}
							</div>
						</div>
					</div>

					{/* Action: Add member to this group */}
					{room.tur !== 'genel' && (
						<button
							type="button"
							className={s.newGroupToggleBtn}
							onClick={() => {
								onClose();
								onOpenAddMembers();
							}}
						>
							<UserPlus size={18} />
							<span>{t('chatAddMembers')}</span>
						</button>
					)}

					{/* Participants List */}
					<div>
						<div
							style={{
								fontSize: '11px',
								fontWeight: 700,
								textTransform: 'uppercase',
								letterSpacing: '0.05em',
								color: 'rgba(255, 255, 255, 0.45)',
								marginBottom: '8px',
							}}
						>
							{t('chatParticipants')} ({members.length})
						</div>

						<div className={s.contactsList}>
							{loading ? (
								<div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
									{t('loading')}
								</div>
							) : members.length === 0 ? (
								<div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
									{t('chatNoMembersFound')}
								</div>
							) : (
								members.map((member) => (
									<div key={member.id} className={s.contactItem} style={{ cursor: 'default' }}>
										<div className={s.contactAvatar}>
											{member.profilFoto ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={member.profilFoto}
													alt={member.ad}
													style={{ width: '100%', height: '100%', objectFit: 'cover' }}
												/>
											) : (
												member.ad.slice(0, 1).toUpperCase()
											)}
										</div>

										<div className={s.contactInfo}>
											<div className={s.contactName}>
												{member.ad} {member.soyad}
											</div>
											<div className={s.contactMeta}>
												{member.rolAd && (
													<span className={s.contactRoleBadge}>{member.rolAd}</span>
												)}
												{member.bolum && <span>{member.bolum}</span>}
											</div>
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>

				{/* Modal Footer */}
				<div className={s.modalFooter}>
					<button
						type="button"
						className={s.modalCloseBtn}
						onClick={onClose}
					>
						{t('close')}
					</button>
				</div>
			</div>
		</div>
	);
}
