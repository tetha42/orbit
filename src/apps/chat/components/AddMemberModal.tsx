'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { X, Search, UserPlus, Check, CheckSquare, Square, ShieldAlert } from 'lucide-react';
import type { ChatOdaItem, ChatContactItem, ChatRoomMemberItem } from '../types';
import s from '../Chat.module.css';

interface AddMemberModalProps {
	isOpen: boolean;
	onClose: () => void;
	room: ChatOdaItem;
	currentUserId: string;
	onAddMembers: (odaId: string, memberIds: string[]) => Promise<void>;
	onCreateGroupWithCounterpart: (memberIds: string[], title?: string) => Promise<void>;
}

export function AddMemberModal({
	isOpen,
	onClose,
	room,
	currentUserId,
	onAddMembers,
	onCreateGroupWithCounterpart,
}: AddMemberModalProps) {
	const { t } = useI18n();
	const [contacts, setContacts] = useState<ChatContactItem[]>([]);
	const [existingMemberIds, setExistingMemberIds] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
	const [groupTitle, setGroupTitle] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const is1on1Dm = room.tur === 'ozel' && (room.memberCount === 2 || Boolean(room.peerUserId));

	useEffect(() => {
		if (!isOpen) {
			setSelectedMemberIds([]);
			setGroupTitle('');
			setSearchQuery('');
			return;
		}

		let isSubscribed = true;
		setLoading(true);

		// Fetch all contacts and current room members concurrently
		Promise.all([
			fetch('/api/chat/rooms?action=contacts').then((r) => r.json()),
			fetch(`/api/chat/rooms?action=members&odaId=${encodeURIComponent(room.id)}`).then((r) => r.json()),
		])
			.then(([contactsData, membersData]) => {
				if (!isSubscribed) return;
				if (contactsData.ok && Array.isArray(contactsData.contacts)) {
					setContacts(contactsData.contacts);
				}
				if (membersData.ok && Array.isArray(membersData.members)) {
					const mIds = membersData.members.map((m: ChatRoomMemberItem) => m.id);
					setExistingMemberIds(mIds);
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

	const eligibleContacts = useMemo(() => {
		return contacts.filter((c) => {
			if (c.id === currentUserId) return false;
			if (is1on1Dm) {
				if (room.peerUserId && c.id === room.peerUserId) return false;
				return true;
			}
			return !existingMemberIds.includes(c.id);
		});
	}, [contacts, currentUserId, is1on1Dm, room.peerUserId, existingMemberIds]);

	const filteredContacts = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return eligibleContacts;
		return eligibleContacts.filter((c) => {
			const fullName = `${c.ad} ${c.soyad}`.toLowerCase();
			const role = (c.rolAd || '').toLowerCase();
			const bolum = (c.bolum || '').toLowerCase();
			return fullName.includes(q) || role.includes(q) || bolum.includes(q);
		});
	}, [eligibleContacts, searchQuery]);

	const toggleMemberSelection = (id: string) => {
		setSelectedMemberIds((prev) =>
			prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
		);
	};

	const handleSubmit = async () => {
		if (selectedMemberIds.length === 0 || submitting) return;
		setSubmitting(true);
		try {
			if (is1on1Dm) {
				const participants = [
					...(room.peerUserId ? [room.peerUserId] : []),
					...selectedMemberIds,
				];
				await onCreateGroupWithCounterpart(participants, groupTitle);
			} else {
				await onAddMembers(room.id, selectedMemberIds);
			}
			onClose();
		} finally {
			setSubmitting(false);
		}
	};

	if (!isOpen) return null;

	const selectedContacts = contacts.filter((c) => selectedMemberIds.includes(c.id));

	return (
		<div className={s.modalOverlay} onClick={onClose}>
			<div className={s.modalDialog} onClick={(e) => e.stopPropagation()}>
				{/* Modal Header */}
				<div className={s.modalHeader}>
					<div className={s.modalTitle}>
						<UserPlus size={18} color="var(--accent)" />
						<span>{t('chatAddMembers')}</span>
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
					{/* 1-on-1 Privacy Notice Banner */}
					{is1on1Dm && (
						<div
							style={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: '10px',
								background: 'rgba(255, 159, 10, 0.12)',
								border: '1px solid rgba(255, 159, 10, 0.3)',
								borderRadius: '10px',
								padding: '10px 14px',
								fontSize: '12px',
								color: 'rgba(255, 255, 255, 0.9)',
								lineHeight: 1.45,
							}}
						>
							<ShieldAlert size={18} color="#ff9f0a" style={{ flexShrink: 0, marginTop: '2px' }} />
							<span>{t('chatPrivacyNotice')}</span>
						</div>
					)}

					{/* Group Title (Optional) for 1-on-1 expansion */}
					{is1on1Dm && (
						<div>
							<input
								type="text"
								className={s.modalSearchInput}
								style={{ paddingLeft: '14px' }}
								placeholder={t('chatGroupSubjectPh')}
								value={groupTitle}
								onChange={(e) => setGroupTitle(e.target.value)}
							/>
						</div>
					)}

					{/* Selected Member Chips */}
					{selectedContacts.length > 0 && (
						<div className={s.chipsContainer}>
							{selectedContacts.map((sc) => (
								<div key={sc.id} className={s.chip}>
									<span>{sc.ad}</span>
									<button
										type="button"
										className={s.chipRemoveBtn}
										onClick={() => toggleMemberSelection(sc.id)}
									>
										<X size={12} />
									</button>
								</div>
							))}
						</div>
					)}

					{/* Search Field */}
					<div className={s.modalSearchRow}>
						<Search size={15} className={s.modalSearchIcon} />
						<input
							type="text"
							className={s.modalSearchInput}
							placeholder={t('chatSearchPlaceholder')}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>

					{/* Contacts List */}
					<div className={s.contactsList}>
						{loading ? (
							<div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
								{t('loading')}
							</div>
						) : filteredContacts.length === 0 ? (
							<div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
								{t('chatNoMembersFound')}
							</div>
						) : (
							filteredContacts.map((contact) => {
								const isSelected = selectedMemberIds.includes(contact.id);
								return (
									<button
										key={contact.id}
										type="button"
										className={`${s.contactItem} ${isSelected ? s.contactItemActive : ''}`}
										onClick={() => toggleMemberSelection(contact.id)}
									>
										<div style={{ color: isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.4)' }}>
											{isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
										</div>

										<div className={s.contactAvatar}>
											{contact.profilFoto ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={contact.profilFoto}
													alt={contact.ad}
													style={{ width: '100%', height: '100%', objectFit: 'cover' }}
												/>
											) : (
												contact.ad.slice(0, 1).toUpperCase()
											)}
										</div>

										<div className={s.contactInfo}>
											<div className={s.contactName}>
												{contact.ad} {contact.soyad}
											</div>
											<div className={s.contactMeta}>
												{contact.rolAd && (
													<span className={s.contactRoleBadge}>{contact.rolAd}</span>
												)}
												{contact.bolum && <span>{contact.bolum}</span>}
											</div>
										</div>
									</button>
								);
							})
						)}
					</div>
				</div>

				{/* Modal Footer */}
				<div className={s.modalFooter}>
					<button
						type="button"
						className={s.modalCloseBtn}
						onClick={onClose}
					>
						{t('cancel')}
					</button>
					<button
						type="button"
						className={s.primaryActionBtn}
						disabled={selectedMemberIds.length === 0 || submitting}
						onClick={handleSubmit}
					>
						<Check size={16} />
						<span>
							{submitting
								? t('chatAdding')
								: is1on1Dm
								? t('chatStartGroupDmBtn')
								: t('chatAddBtn')}
						</span>
					</button>
				</div>
			</div>
		</div>
	);
}
