'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { X, Search, Users, ArrowLeft, Check, CheckSquare, Square } from 'lucide-react';
import type { ChatContactItem } from '../types';
import s from '../Chat.module.css';

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

	const filteredContacts = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return contacts;
		return contacts.filter((c) => {
			const fullName = `${c.ad} ${c.soyad}`.toLowerCase();
			const role = (c.rolAd || '').toLowerCase();
			const bolum = (c.bolum || '').toLowerCase();
			return fullName.includes(q) || role.includes(q) || bolum.includes(q);
		});
	}, [contacts, searchQuery]);

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
				{/* Modal Header */}
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

				{/* Modal Body */}
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

					{/* Selected Chips in Group Mode */}
					{mode === 'group' && selectedContacts.length > 0 && (
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

					{/* Search Input */}
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
										onClick={() => {
											if (mode === 'group') {
												toggleMemberSelection(contact.id);
											} else {
												void handleDirectClick(contact.id);
											}
										}}
									>
										{mode === 'group' && (
											<div style={{ color: isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.4)' }}>
												{isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
											</div>
										)}

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

				{/* Modal Footer (only in group mode) */}
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
