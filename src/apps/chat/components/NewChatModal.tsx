'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { X, Users, ArrowLeft, Check } from 'lucide-react';
import type { ChatContactItem } from '../types';
import { ContactPickerList, filterChatContacts } from './ContactPickerList';
import s from '../ChatModals.module.css';

interface NewChatModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelectContact: (targetUserId: string) => Promise<void>;
	onCreateGroup: (memberIds: string[], title?: string) => Promise<void>;
}

export function NewChatModal({
	isOpen,
	onClose,
	onSelectContact,
	onCreateGroup,
}: NewChatModalProps) {
	const { t } = useI18n();
	const [contacts, setContacts] = useState<ChatContactItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [mode, setMode] = useState<'direct' | 'group'>('direct');
	const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
	const [groupTitle, setGroupTitle] = useState('');
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!isOpen) {
			setMode('direct');
			setSelectedMemberIds([]);
			setGroupTitle('');
			setSearchQuery('');
			return;
		}

		let isSubscribed = true;
		setLoading(true);

		void fetch('/api/chat/rooms?action=contacts')
			.then((res) => res.json())
			.then((data) => {
				if (isSubscribed && data.ok && Array.isArray(data.contacts)) {
					setContacts(data.contacts);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (isSubscribed) setLoading(false);
			});

		return () => {
			isSubscribed = false;
		};
	}, [isOpen]);

	const filteredContacts = useMemo(
		() => filterChatContacts(contacts, searchQuery),
		[contacts, searchQuery]
	);

	const toggleMemberSelection = (id: string) => {
		setSelectedMemberIds((prev) =>
			prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
		);
	};

	const handleCreateGroup = async () => {
		if (selectedMemberIds.length === 0 || submitting) return;
		setSubmitting(true);
		try {
			await onCreateGroup(selectedMemberIds, groupTitle);
			onClose();
		} finally {
			setSubmitting(false);
		}
	};

	const handleDirectClick = async (contactId: string) => {
		if (submitting) return;
		setSubmitting(true);
		try {
			await onSelectContact(contactId);
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
						{mode === 'group' && (
							<button
								type="button"
								className={s.modalCloseBtn}
								onClick={() => setMode('direct')}
								style={{ marginRight: '4px' }}
								title={t('back')}
							>
								<ArrowLeft size={16} />
							</button>
						)}
						<span>{mode === 'group' ? t('chatNewGroup') : t('chatNewChat')}</span>
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
					{mode === 'direct' ? (
						<button
							type="button"
							className={s.newGroupToggleBtn}
							onClick={() => setMode('group')}
						>
							<Users size={18} />
							<span>{t('chatNewGroup')}</span>
						</button>
					) : (
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
						multiSelect={mode === 'group'}
						selectedIds={selectedMemberIds}
						selectedContacts={selectedContacts}
						onToggleOrSelect={(contactId) => {
							if (mode === 'group') {
								toggleMemberSelection(contactId);
							} else {
								void handleDirectClick(contactId);
							}
						}}
					/>
				</div>

				{mode === 'group' && (
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
							onClick={handleCreateGroup}
						>
							<Check size={16} />
							<span>
								{submitting
									? t('chatCreating')
									: fill(t('chatCreateGroupBtn'), { n: selectedMemberIds.length })}
							</span>
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
