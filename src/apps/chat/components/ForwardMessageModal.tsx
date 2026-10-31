'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { X, Search, Forward, Users, MessageSquare, Check } from 'lucide-react';
import type { ChatOdaItem, ChatMessageItem } from '../types';
import s from '../Chat.module.css';

interface ForwardMessageModalProps {
	isOpen: boolean;
	onClose: () => void;
	message: ChatMessageItem | null;
	rooms: ChatOdaItem[];
	onForward: (mesajId: string, targetOdaIds: string[]) => Promise<{ ok: boolean; count?: number }>;
}

export function ForwardMessageModal({
	isOpen,
	onClose,
	message,
	rooms,
	onForward,
}: ForwardMessageModalProps) {
	const { t, language } = useI18n();
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setSelectedRoomIds([]);
			setSearchQuery('');
			setIsSubmitting(false);
		}
	}, [isOpen]);

	const filteredRooms = useMemo(() => {
		const q = searchQuery.trim().toLocaleLowerCase(language === 'tr' ? 'tr-TR' : undefined);
		if (!q) return rooms;
		return rooms.filter((r) =>
			r.ad.toLocaleLowerCase(language === 'tr' ? 'tr-TR' : undefined).includes(q)
		);
	}, [rooms, searchQuery, language]);

	if (!isOpen || !message) return null;

	const toggleRoom = (id: string) => {
		setSelectedRoomIds((prev) =>
			prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
		);
	};

	const handleForwardSubmit = async () => {
		if (selectedRoomIds.length === 0 || isSubmitting) return;
		setIsSubmitting(true);
		try {
			const res = await onForward(message.id, selectedRoomIds);
			if (res.ok) {
				onClose();
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className={s.modalOverlay} onClick={onClose}>
			<div
				className={s.modalCard}
				style={{ maxWidth: '440px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className={s.modalHeader}>
					<div className={s.modalTitle}>
						<Forward size={18} color="var(--accent)" />
						<span>{t('chatForwardModalTitle')}</span>
					</div>
					<button
						type="button"
						className={s.modalCloseBtn}
						onClick={onClose}
						aria-label={t('close')}
					>
						<X size={16} />
					</button>
				</div>

				{/* Body */}
				<div className={s.modalBody} style={{ padding: '14px 16px', gap: '12px' }}>
					{/* Message preview snippet */}
					<div className={s.forwardPreviewCard}>
						<div className={s.forwardPreviewSender}>
							<Forward size={12} />
							<span>{message.gonderenAd}</span>
						</div>
						<div className={s.forwardPreviewText}>
							{message.icerik ? message.icerik.slice(0, 160) : ''}
							{message.icerik && message.icerik.length > 160 ? '…' : ''}
						</div>
					</div>

					{/* Search input */}
					<div className={s.modalSearchRow}>
						<Search size={15} className={s.modalSearchIcon} />
						<input
							type="text"
							className={s.modalSearchInput}
							placeholder={t('chatForwardSearchPh')}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							autoFocus
						/>
					</div>

					<div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
						{t('chatSelectRoomsToForward')}
					</div>

					{/* Room Selection List */}
					<div className={s.forwardRoomsList}>
						{filteredRooms.length === 0 ? (
							<div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
								{t('chatForwardNoRooms')}
							</div>
						) : (
							filteredRooms.map((room) => {
								const isSelected = selectedRoomIds.includes(room.id);
								const isGroup = room.tur === 'takim' || (room.tur === 'ozel' && (room.memberCount || 0) > 2);

								return (
									<button
										key={room.id}
										type="button"
										className={`${s.forwardRoomRow} ${isSelected ? s.forwardRoomRowSelected : ''}`}
										onClick={() => toggleRoom(room.id)}
									>
										<div className={s.forwardRoomAvatar}>
											{room.avatar ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={room.avatar}
													alt={room.ad}
													style={{ width: '100%', height: '100%', objectFit: 'cover' }}
												/>
											) : isGroup ? (
												<Users size={16} />
											) : room.tur === 'ozel' ? (
												<span>{(room.ad || '?').slice(0, 1).toUpperCase()}</span>
											) : (
												<MessageSquare size={16} />
											)}
										</div>

										<div className={s.forwardRoomInfo}>
											<span className={s.forwardRoomName}>{room.ad}</span>
											<span className={s.forwardRoomType}>
												{room.tur === 'genel'
													? t('chatPublicSub')
													: room.tur === 'takim'
													? t('chatTeamSub')
													: t('chatPrivateSub')}
											</span>
										</div>

										<div className={`${s.forwardCheckbox} ${isSelected ? s.forwardCheckboxChecked : ''}`}>
											{isSelected && <Check size={12} strokeWidth={3} />}
										</div>
									</button>
								);
							})
						)}
					</div>
				</div>

				{/* Footer */}
				<div className={s.forwardModalFooter}>
					<button
						type="button"
						className={s.forwardCancelBtn}
						onClick={onClose}
						disabled={isSubmitting}
					>
						{t('cancel')}
					</button>
					<button
						type="button"
						className={s.forwardSubmitBtn}
						onClick={handleForwardSubmit}
						disabled={selectedRoomIds.length === 0 || isSubmitting}
					>
						<Forward size={14} />
						<span>{fill(t('chatForwardSendBtn'), { n: selectedRoomIds.length })}</span>
					</button>
				</div>
			</div>
		</div>
	);
}
