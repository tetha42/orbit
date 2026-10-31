'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
	Package,
	Clock,
	UserCheck,
	PlusCircle,
	Search,
	AlertTriangle,
	ChevronRight,
	RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { returnStatus } from '@/lib/inventory';
import { formatDate } from '@/core/data/format';
import type { useInventory } from '../hooks/useInventory';
import type { InventoryItem } from '../types';
import { ItemDetailModal } from './ItemDetailModal';
import { LoanModal } from './LoanModal';
import { ItemFormModal } from './ItemFormModal';
import s from './InventoryMobile.module.css';

export interface InventoryMobileViewProps {
	inv: ReturnType<typeof useInventory>;
}

type InventoryMobileTab = 'items' | 'loans' | 'mine' | 'add';

export function InventoryMobileView({ inv }: InventoryMobileViewProps) {
	const { t } = useI18n();
	const [activeTab, setActiveTab] = useState<InventoryMobileTab>('items');
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	const loanedItems = useMemo(
		() => inv.items.filter((i) => i.status === 'oduncte'),
		[inv.items]
	);

	const myItems = useMemo(
		() => inv.items.filter((i) => i.status === 'oduncte' && i.oduncAlanId === inv.currentUserId),
		[inv.items, inv.currentUserId]
	);

	const handleTabChange = (tabId: InventoryMobileTab) => {
		if (tabId === 'add') {
			if (inv.isManager) {
				inv.setForm({ id: null });
			}
			return;
		}
		if (activeTab === tabId) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	const tabs: Array<{
		id: InventoryMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{ id: 'items', label: t('invMobTabItems'), Icon: Package },
		{
			id: 'loans',
			label: t('invMobTabLoans'),
			Icon: Clock,
			badgeCount: inv.counts.gecikmis > 0 ? inv.counts.gecikmis : undefined,
		},
		{
			id: 'mine',
			label: t('invMobTabMine'),
			Icon: UserCheck,
			badgeCount: myItems.length > 0 ? myItems.length : undefined,
		},
		{ id: 'add', label: t('invMobAddItem'), Icon: PlusCircle },
	];

	const detail = inv.byId(inv.detailId);
	const loanItem = inv.loan ? inv.byId(inv.loan.id) : null;
	const formItem = inv.form?.id ? inv.byId(inv.form.id) : null;

	const getStatusBadge = (item: InventoryItem) => {
		switch (item.status) {
			case 'saglam':
				return <span className={`${s.badge} ${s.badgeOk}`}>{t('invStatusAvailable')}</span>;
			case 'oduncte': {
				const info = returnStatus(item.iadeTarihi, inv.now);
				if (info?.gecikti) {
					return <span className={`${s.badge} ${s.badgeDanger}`}>{t('invStatusOverdue')}</span>;
				}
				return <span className={`${s.badge} ${s.badgeWarn}`}>{t('invStatusOnLoan')}</span>;
			}
			case 'arizali':
				return <span className={`${s.badge} ${s.badgeDanger}`}>{t('invStatusBroken')}</span>;
			case 'kayip':
				return <span className={`${s.badge} ${s.badgeMuted}`}>{t('invStatusLost')}</span>;
			default:
				return null;
		}
	};

	// 1. All Items Tab
	const renderItems = () => (
		<>
			{/* Search Box */}
			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('invSearchPlaceholder')}
					value={inv.arama}
					onChange={(e) => inv.setArama(e.target.value)}
				/>
			</div>

			{/* Category Chips */}
			<div className={s.chipRow}>
				<button
					type="button"
					className={`${s.chip} ${inv.kategori === '' ? s.chipActive : ''}`}
					onClick={() => inv.setKategori('')}
				>
					{t('invFilterAll')} ({inv.items.length})
				</button>
				{inv.categories.map((cat) => (
					<button
						key={cat}
						type="button"
						className={`${s.chip} ${inv.kategori === cat ? s.chipActive : ''}`}
						onClick={() => inv.setKategori(inv.kategori === cat ? '' : cat)}
					>
						<span>{cat}</span>
					</button>
				))}
			</div>

			{/* Items List */}
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
									<div className={s.itemName}>{item.ad}</div>
									<div className={s.itemSub}>
										<span style={{ fontFamily: 'ui-monospace, monospace' }}>{item.kod}</span>
										<span>•</span>
										<span>{item.kategori}</span>
										{item.konum && (
											<>
												<span>•</span>
												<span>{item.konum}</span>
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

	// 2. Loans Tab
	const renderLoans = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('invMobTabLoans')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('invLoansDesc')}
				</p>
			</div>

			{inv.data === null ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<div>{t('loading')}</div>
				</div>
			) : loanedItems.length === 0 ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
					<div>{t('invNoLoans')}</div>
				</div>
			) : (
				loanedItems.map((item) => {
					const info = returnStatus(item.iadeTarihi, inv.now);
					return (
						<div
							key={item.id}
							className={s.loanCard}
							onClick={() => inv.setDetailId(item.id)}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f8fafc' }}>
									{item.ad}
								</div>
								<span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', opacity: 0.6 }}>
									{item.kod}
								</span>
							</div>

							<div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', opacity: 0.8 }}>
								<div>
									<strong>{t('invBorrower')}:</strong> {item.oduncAlanAdSoyad || '—'}
								</div>
								{item.oduncTarihi && (
									<div>
										<strong>{t('invLoanDate')}:</strong> {formatDate(item.oduncTarihi)}
									</div>
								)}
								{item.iadeTarihi && (
									<div>
										<strong>{t('invReturnDate')}:</strong> {formatDate(item.iadeTarihi)}
									</div>
								)}
							</div>

							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
								{info?.gecikti ? (
									<span className={`${s.badge} ${s.badgeDanger}`}>
										<AlertTriangle size={12} /> {info.gun} {t('invDaysOverdue')}
									</span>
								) : info ? (
									<span className={`${s.badge} ${s.badgeWarn}`}>
										<Clock size={12} /> {info.gun} {t('invDaysLeft')}
									</span>
								) : (
									<span className={`${s.badge} ${s.badgeOk}`}>{t('invStatusOnLoan')}</span>
								)}

								<span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
									{t('details')} ›
								</span>
							</div>
						</div>
					);
				})
			)}
		</div>
	);

	// 3. My Items Tab
	const renderMine = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('invMobTabMine')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('invMyItemsDesc')}
				</p>
			</div>

			{inv.data === null ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<div>{t('loading')}</div>
				</div>
			) : myItems.length === 0 ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<UserCheck size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
					<div>{t('invNoMyItems')}</div>
				</div>
			) : (
				myItems.map((item) => {
					const info = returnStatus(item.iadeTarihi, inv.now);
					return (
						<div key={item.id} className={s.loanCard}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f8fafc' }}>
									{item.ad}
								</div>
								<span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', opacity: 0.6 }}>
									{item.kod}
								</span>
							</div>

							<div style={{ fontSize: '12px', opacity: 0.75 }}>
								{item.iadeTarihi ? `${t('invReturnDate')}: ${formatDate(item.iadeTarihi)}` : ''}
							</div>

							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
								{info?.gecikti ? (
									<span className={`${s.badge} ${s.badgeDanger}`}>
										{info.gun} {t('invDaysOverdue')}
									</span>
								) : info ? (
									<span className={`${s.badge} ${s.badgeWarn}`}>
										{info.gun} {t('invDaysLeft')}
									</span>
								) : null}

								<button
									type="button"
									className={s.chip}
									style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', padding: '5px 12px' }}
									onClick={() => inv.setLoan({ id: item.id, mode: 'return' })}
								>
									<RotateCcw size={12} />
									<span>{t('invReturnBtn')}</span>
								</button>
							</div>
						</div>
					);
				})
			)}
		</div>
	);

	return (
		<div className={s.mobileRoot}>
			{/* Scrollable Content Area */}
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'items' && renderItems()}
				{activeTab === 'loans' && renderLoans()}
				{activeTab === 'mine' && renderMine()}
			</div>

			{/* Fixed Apple iOS Bottom Tab Bar */}
			<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('invMobNavAria')}>
				{tabs.map((tab) => {
					const activeTabMatched = activeTab === tab.id;
					const IconComponent = tab.Icon;
					const isAdd = tab.id === 'add';
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={activeTabMatched}
							className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
							onClick={() => handleTabChange(tab.id)}
							title={tab.label}
							style={isAdd ? { color: 'var(--accent)' } : undefined}
						>
							<div className={s.mobileBottomTabIconWrap}>
								<IconComponent size={20} strokeWidth={activeTabMatched ? 2.3 : 1.7} />
								{tab.badgeCount !== undefined && (
									<span className={s.tabBadge}>{tab.badgeCount}</span>
								)}
							</div>
							<span className={s.mobileBottomTabLabel}>{tab.label}</span>
						</button>
					);
				})}
			</nav>

			{/* Modals */}
			{detail && (
				<ItemDetailModal
					item={detail}
					selfId={inv.currentUserId}
					isManager={inv.isManager}
					isAlumni={inv.isAlumni}
					now={inv.now}
					onClose={() => inv.setDetailId(null)}
					onEdit={() => {
						inv.setDetailId(null);
						inv.setForm({ id: detail.id });
					}}
					onLoan={(mode) => {
						inv.setDetailId(null);
						inv.setLoan({ id: detail.id, mode });
					}}
					onChanged={(msg, err) => void inv.done(msg, err)}
				/>
			)}

			{inv.loan && loanItem && (
				<LoanModal
					item={loanItem}
					mode={inv.loan.mode}
					selfId={inv.currentUserId}
					isManager={inv.isManager}
					onClose={() => inv.setLoan(null)}
					onDone={(msg) => void inv.done(msg)}
				/>
			)}

			{inv.form && (
				<ItemFormModal
					item={formItem ?? undefined}
					onClose={() => inv.setForm(null)}
					onSaved={(msg) => void inv.done(msg)}
				/>
			)}
		</div>
	);
}
