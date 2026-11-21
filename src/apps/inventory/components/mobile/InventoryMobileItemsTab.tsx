'use client';

import React from 'react';
import { Package, Search, ChevronRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { returnStatus } from '@/lib/inventory';
import type { useInventory } from '../../hooks/useInventory';
import type { InventoryItem } from '../../types';
import s from '../InventoryMobile.module.css';

interface InventoryMobileItemsTabProps {
	inv: ReturnType<typeof useInventory>;
}

export function InventoryMobileItemsTab({ inv }: InventoryMobileItemsTabProps) {
	const { t } = useI18n();

	const getStatusBadge = (item: InventoryItem) => {
		switch (item.status) {
			case 'available':
				return <span className={`${s.badge} ${s.badgeOk}`}>{t('invStatusAvailable')}</span>;
			case 'on_loan': {
				const info = returnStatus(item.dueDate, inv.now);
				if (info?.overdue) {
					return <span className={`${s.badge} ${s.badgeDanger}`}>{t('invStatusOverdue')}</span>;
				}
				return <span className={`${s.badge} ${s.badgeWarn}`}>{t('invStatusOnLoan')}</span>;
			}
			case 'faulty':
				return <span className={`${s.badge} ${s.badgeDanger}`}>{t('invStatusBroken')}</span>;
			case 'lost':
				return <span className={`${s.badge} ${s.badgeMuted}`}>{t('invStatusLost')}</span>;
			default:
				return null;
		}
	};

	return (
		<>
			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('invSearchPlaceholder')}
					value={inv.search}
					onChange={(e) => inv.setSearch(e.target.value)}
				/>
			</div>

			<div className={s.chipRow}>
				<button
					type="button"
					className={`${s.chip} ${inv.category === '' ? s.chipActive : ''}`}
					onClick={() => inv.setCategory('')}
				>
					{t('invFilterAll')} ({inv.items.length})
				</button>
				{inv.categories.map((cat) => (
					<button
						key={cat}
						type="button"
						className={`${s.chip} ${inv.category === cat ? s.chipActive : ''}`}
						onClick={() => inv.setCategory(inv.category === cat ? '' : cat)}
					>
						<span>{cat}</span>
					</button>
				))}
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{inv.data === null ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{t('loading')}
					</div>
				) : inv.visible.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{t('invEmpty')}
					</div>
				) : (
					inv.visible.map((item) => (
						<div
							key={item.id}
							className={s.itemCard}
							onClick={() => inv.setDetailId(item.id)}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
								<div className={s.itemIconWrap}>
									<Package size={20} />
								</div>
								<div className={s.itemDetails}>
									<div className={s.itemName}>{item.name}</div>
									<div className={s.itemSub}>
										<span style={{ fontFamily: 'ui-monospace, monospace' }}>{item.code}</span>
										<span>•</span>
										<span>{item.category}</span>
										{item.location && (
											<>
												<span>•</span>
												<span>{item.location}</span>
											</>
										)}
									</div>
								</div>
							</div>

							<div className={s.itemRight}>
								{getStatusBadge(item)}
								<ChevronRight size={14} opacity={0.4} style={{ marginTop: '2px' }} />
							</div>
						</div>
					))
				)}
			</div>
		</>
	);
}
