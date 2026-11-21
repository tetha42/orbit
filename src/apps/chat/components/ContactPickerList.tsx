'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { X, Search, CheckSquare, Square } from 'lucide-react';
import type { ChatContactItem } from '../types';
import s from '../ChatModals.module.css';

export function filterChatContacts(contacts: ChatContactItem[], searchQuery: string): ChatContactItem[] {
	const q = searchQuery.trim().toLowerCase();
	if (!q) return contacts;
	return contacts.filter((c) => {
		const fullName = `${c.name} ${c.surname}`.toLowerCase();
		const role = (c.roleName || '').toLowerCase();
		const department = (c.department || '').toLowerCase();
		return fullName.includes(q) || role.includes(q) || department.includes(q);
	});
}

interface ContactPickerListProps {
	contacts: ChatContactItem[];
	loading: boolean;
	searchQuery: string;
	onSearchChange: (value: string) => void;
	multiSelect?: boolean;
	selectedIds?: string[];
	selectedContacts?: ChatContactItem[];
	onToggleOrSelect: (contactId: string) => void;
}

export function ContactPickerList({
	contacts,
	loading,
	searchQuery,
	onSearchChange,
	multiSelect = false,
	selectedIds = [],
	selectedContacts = [],
	onToggleOrSelect,
}: ContactPickerListProps) {
	const { t } = useI18n();

	return (
		<>
			{multiSelect && selectedContacts.length > 0 && (
				<div className={s.chipsContainer}>
					{selectedContacts.map((sc) => (
						<div key={sc.id} className={s.chip}>
							<span>{sc.name}</span>
							<button
								type="button"
								className={s.chipRemoveBtn}
								onClick={() => onToggleOrSelect(sc.id)}
							>
								<X size={12} />
							</button>
						</div>
					))}
				</div>
			)}

			<div className={s.modalSearchRow}>
				<Search size={15} className={s.modalSearchIcon} />
				<input
					type="text"
					className={s.modalSearchInput}
					placeholder={t('chatSearchPlaceholder')}
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
				/>
			</div>

			<div className={s.contactsList}>
				{loading ? (
					<div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
						{t('loading')}
					</div>
				) : contacts.length === 0 ? (
					<div style={{ padding: '24px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
						{t('chatNoMembersFound')}
					</div>
				) : (
					contacts.map((contact) => {
						const isSelected = selectedIds.includes(contact.id);
						return (
							<button
								key={contact.id}
								type="button"
								className={`${s.contactItem} ${isSelected ? s.contactItemActive : ''}`}
								onClick={() => onToggleOrSelect(contact.id)}
							>
								{multiSelect && (
									<div style={{ color: isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.4)' }}>
										{isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
									</div>
								)}

								<div className={s.contactAvatar}>
									{contact.profilePhoto ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={contact.profilePhoto}
											alt={contact.name}
											style={{ width: '100%', height: '100%', objectFit: 'cover' }}
										/>
									) : (
										contact.name.slice(0, 1).toUpperCase()
									)}
								</div>

								<div className={s.contactInfo}>
									<div className={s.contactName}>
										{contact.name} {contact.surname}
									</div>
									<div className={s.contactMeta}>
										{contact.roleName && (
											<span className={s.contactRoleBadge}>{contact.roleName}</span>
										)}
										{contact.department && <span>{contact.department}</span>}
									</div>
								</div>
							</button>
						);
					})
				)}
			</div>
		</>
	);
}
