'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { X, UserPlus, Check, ShieldAlert } from 'lucide-react';
import type { ChatRoomItem, ChatContactItem, ChatRoomMemberItem } from '../types';
import { ContactPickerList, filterChatContacts } from './ContactPickerList';
import s from '../ChatModals.module.css';

interface AddMemberModalProps {
	isOpen: boolean;
	onClose: () => void;
	room: ChatRoomItem;
	currentUserId: string;
	onAddMembers: (roomId: string, memberIds: string[]) => Promise<void>;
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

	const is1on1Dm = room.typeValue === 'private' && (room.memberCount === 2 || Boolean(room.peerUserId));

	useEffect(() => {
		if (!isOpen) {
			setSelectedMemberIds([]);
			setGroupTitle('');
			setSearchQuery('');
			return;
		}

		let isSubscribed = true;
		setLoading(true);

		Promise.all([
			fetch('/api/chat/rooms?action=contacts').then((r) => r.json()),
			fetch(`/api/chat/rooms?action=members&roomId=${encodeURIComponent(room.id)}`).then((r) => r.json()),
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

	const filteredContacts = useMemo(
		() => filterChatContacts(eligibleContacts, searchQuery),
		[eligibleContacts, searchQuery]
	);

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

				<div className={s.modalBody}>
					{is1on1Dm && (
						<div
							style={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: '10px',
								background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
								border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
								borderRadius: '10px',
								padding: '10px 14px',
								fontSize: '12px',
								color: 'rgba(255, 255, 255, 0.9)',
								lineHeight: 1.45,
							}}
						>
							<ShieldAlert size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
							<span>{t('chatPrivacyNotice')}</span>
						</div>
					)}

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

					<ContactPickerList
						contacts={filteredContacts}
						loading={loading}
						searchQuery={searchQuery}
						onSearchChange={setSearchQuery}
						multiSelect
						selectedIds={selectedMemberIds}
						selectedContacts={selectedContacts}
						onToggleOrSelect={toggleMemberSelection}
					/>
				</div>

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
