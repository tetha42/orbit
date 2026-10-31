'use client';

import React, { useState, useRef } from 'react';
import {
	Receipt,
	Wallet,
	PieChart,
	PlusCircle,
	Search,
	TrendingUp,
	TrendingDown,
	ArrowLeftRight,
	ExternalLink,
	Check,
	Trash2,
	X,
	Landmark,
	FileText,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatKurus } from '@/lib/budget';
import { formatDate } from '@/core/data/format';
import type { VaultSummary, VaultRecord } from '../types';
import { useVaultLedger } from '../hooks/useKasaLedger';
import { VaultInsights } from './KasaInsights';
import { VaultEntryModal } from './KasaEntryModal';
import { TransferModal } from './TransferModal';
import s from './BudgetMobile.module.css';

export interface BudgetMobileViewProps {
	vaults: VaultSummary[];
	active: VaultSummary | undefined;
	general: VaultSummary[];
	projects: VaultSummary[];
	selected: string | null;
	onSelect: (teamId: string | null) => void;
	refetch: () => Promise<void>;
}

type BudgetMobileTab = 'transactions' | 'wallets' | 'insights' | 'add';

const tl = (kurus: number) => `₺${formatKurus(kurus)}`;

export function BudgetMobileView({
	vaults,
	active,
	general,
	projects,
	onSelect,
	refetch,
}: BudgetMobileViewProps) {
	const { t } = useI18n();
	const [activeTab, setActiveTab] = useState<BudgetMobileTab>('transactions');
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const [selectedRecord, setSelectedRecord] = useState<VaultRecord | null>(null);

	const ledger = useVaultLedger({
		teamId: active?.teamId ?? null,
		onChanged: refetch,
		vaults,
	});

	const handleTabChange = (tabId: BudgetMobileTab) => {
		if (tabId === 'add') {
			ledger.setModal({ kind: 'new' });
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
		id: BudgetMobileTab;
		label: string;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{ id: 'transactions', label: t('kasaMobTabTransactions'), Icon: Receipt },
		{ id: 'wallets', label: t('kasaMobTabWallets'), Icon: Wallet },
		{ id: 'insights', label: t('kasaMobTabInsights'), Icon: PieChart },
		{ id: 'add', label: t('kasaMobAddEntry'), Icon: PlusCircle },
	];

	// 1. Transactions Tab Content
	const renderTransactions = () => (
		<>
			{/* Account Summary Hero Card */}
			<div className={s.heroCard}>
				<div className={s.heroHeader}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Landmark size={18} color="var(--accent)" />
						<span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
							{active?.ad ?? t('kasaGeneralTitle')}
						</span>
					</div>
					<span className={`${s.badge} ${s.badgeOk}`}>
						{(active?.netBakiyeKurus ?? 0) >= 0 ? t('kasaStatusPositive') : t('kasaStatusDeficit')}
					</span>
				</div>

				<div className={s.heroBalance}>{tl(ledger.summary?.netBakiyeKurus ?? 0)}</div>

				<div className={s.statRow}>
					<div className={s.statItem}>
						<span className={s.statLabel}>{t('kasaTotalIncome')}</span>
						<span className={s.statValIncome}>+{tl(ledger.summary?.toplamGelirKurus ?? 0)}</span>
					</div>
					<div className={s.statItem}>
						<span className={s.statLabel}>{t('kasaTotalExpense')}</span>
						<span className={s.statValExpense}>-{tl(ledger.summary?.toplamGiderKurus ?? 0)}</span>
					</div>
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('kasaSearchPlaceholder')}
					value={ledger.arama}
					onChange={(e) => ledger.setArama(e.target.value)}
				/>
			</div>

			{/* Filter Chips: Type (Hepsi, Gelir, Gider) */}
			<div className={s.chipRow}>
				<button
					type="button"
					className={`${s.chip} ${ledger.tur === 'hepsi' ? s.chipActive : ''}`}
					onClick={() => ledger.setTur('hepsi')}
				>
					{t('kasaFilterAll')} ({ledger.records.length})
				</button>
				<button
					type="button"
					className={`${s.chip} ${ledger.tur === 'gelir' ? s.chipActive : ''}`}
					onClick={() => ledger.setTur('gelir')}
				>
					<TrendingUp size={13} color="#34c759" />
					<span>{t('kasaFilterIncome')}</span>
				</button>
				<button
					type="button"
					className={`${s.chip} ${ledger.tur === 'gider' ? s.chipActive : ''}`}
					onClick={() => ledger.setTur('gider')}
				>
					<TrendingDown size={13} color="#ff453a" />
					<span>{t('kasaFilterExpense')}</span>
				</button>
			</div>

			{/* Transaction Items List */}
			<div className={s.txList}>
				{ledger.filtered.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{ledger.isLoading
							? t('loading')
							: ledger.records.length === 0
							? t('kasaEmptyLedger')
							: t('kasaNoMatch')}
					</div>
				) : (
					ledger.filtered.map((r) => {
						const isIncome = r.tur === 'gelir';
						return (
							<div
								key={r.id}
								className={s.txItem}
								onClick={() => setSelectedRecord(r)}
							>
								<div className={s.txLeft}>
									<div className={`${s.txIconWrap} ${isIncome ? s.txIconIncome : s.txIconExpense}`}>
										{isIncome ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
									</div>
									<div className={s.txDetails}>
										<div className={s.txDesc}>{r.aciklama}</div>
										<div className={s.txSub}>
											<span>{formatDate(r.date)}</span>
											<span>•</span>
											<span>{r.kategori}</span>
											{r.fisFotoUrl && (
												<>
													<span>•</span>
													<span title={t('kasaReceiptAttached')} style={{ display: 'inline-flex', alignItems: 'center' }}>
														<FileText size={11} color="var(--accent)" />
													</span>
												</>
											)}
										</div>
									</div>
								</div>

								<div className={s.txRight}>
									<span className={`${s.txAmount} ${isIncome ? s.txAmountIncome : s.txAmountExpense}`}>
										{isIncome ? '+' : '-'}{tl(r.tutarKurus)}
									</span>
									{r.karsiKasaAd && (
										<span style={{ fontSize: '10px', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '3px' }}>
											<ArrowLeftRight size={10} />
											<span>{r.karsiKasaAd}</span>
										</span>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</>
	);

	// 2. Wallets Tab Content
	const renderWallets = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
				<div>
					<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('kasaMobTabWallets')}</h3>
					<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
						{t('kasaSelectActiveNotice')}
					</p>
				</div>
				{ledger.canTransfer && (
					<button
						type="button"
						className={s.chip}
						style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
						onClick={() => ledger.setModal({ kind: 'transfer' })}
					>
						<ArrowLeftRight size={13} />
						<span>{t('kasaTransferBtn')}</span>
					</button>
				)}
			</div>

			{/* General Kasa Section */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				<div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.04em' }}>
					{t('kasaGeneralTitle')}
				</div>
				{general.map((k) => {
					const isCurrent = active?.teamId === k.teamId;
					return (
						<div
							key={k.teamId ?? 'genel'}
							className={`${s.walletCard} ${isCurrent ? s.walletCardActive : ''}`}
							onClick={() => onSelect(k.teamId)}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
								<div
									style={{
										width: '40px',
										height: '40px',
										borderRadius: '12px',
										background: 'rgba(10, 132, 255, 0.15)',
										color: '#0a84ff',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<Landmark size={20} />
								</div>
								<div>
									<div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{k.ad}</div>
									<div style={{ fontSize: '11.5px', opacity: 0.6 }}>
										{t('kasaGeneralDesc')}
									</div>
								</div>
							</div>

							<div style={{ textAlign: 'right' }}>
								<div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>
									{tl(k.netBakiyeKurus)}
								</div>
								{isCurrent && (
									<span className={`${s.badge} ${s.badgeOk}`} style={{ marginTop: '4px' }}>
										<Check size={11} strokeWidth={2.5} /> {t('kasaActiveBadge')}
									</span>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Project Kasaları Section */}
			{projects.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
					<div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.04em' }}>
						{t('kasaProjectsTitle')} ({projects.length})
					</div>
					{projects.map((k) => {
						const isCurrent = active?.teamId === k.teamId;
						return (
							<div
								key={k.teamId ?? 'proje'}
								className={`${s.walletCard} ${isCurrent ? s.walletCardActive : ''}`}
								onClick={() => onSelect(k.teamId)}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
									<div
										style={{
											width: '40px',
											height: '40px',
											borderRadius: '12px',
											background: 'rgba(48, 209, 88, 0.15)',
											color: '#30d158',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<Wallet size={20} />
									</div>
									<div>
										<div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{k.ad}</div>
										<div style={{ fontSize: '11.5px', opacity: 0.6 }}>
											{t('kasaProjectDesc')}
										</div>
									</div>
								</div>

								<div style={{ textAlign: 'right' }}>
									<div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>
										{tl(k.netBakiyeKurus)}
									</div>
									{isCurrent && (
										<span className={`${s.badge} ${s.badgeOk}`} style={{ marginTop: '4px' }}>
											<Check size={11} strokeWidth={2.5} /> {t('kasaActiveBadge')}
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);

	// 3. Insights Tab Content
	const renderInsights = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div className={s.card}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<span style={{ fontSize: '13px', fontWeight: 700 }}>{t('kasaInsightsTitle')}</span>
					<span style={{ fontSize: '11.5px', opacity: 0.6 }}>{active?.ad}</span>
				</div>
				<VaultInsights
					dagilim={ledger.dagilim}
					kategori={ledger.kategori}
					onSelectKategori={(c) => ledger.setKategori(c)}
					aylar={ledger.aylar}
					ay={ledger.ay}
					onSelectAy={(a) => ledger.setAy(a)}
					maxMonth={ledger.maxMonth}
				/>
			</div>
		</div>
	);

	return (
		<div className={s.mobileRoot}>
			{/* Scrollable Content Area */}
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'transactions' && renderTransactions()}
				{activeTab === 'wallets' && renderWallets()}
				{activeTab === 'insights' && renderInsights()}
			</div>

			{/* Fixed Apple iOS Bottom Tab Bar */}
			<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('kasaMobNavAria')}>
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
							</div>
							<span className={s.mobileBottomTabLabel}>{tab.label}</span>
						</button>
					);
				})}
			</nav>

			{/* Transaction Quick Detail Modal */}
			{selectedRecord && (
				<div
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(0, 0, 0, 0.7)',
						backdropFilter: 'blur(8px)',
						zIndex: 100,
						display: 'flex',
						alignItems: 'flex-end',
					}}
					onClick={() => setSelectedRecord(null)}
				>
					<div
						style={{
							width: '100%',
							background: '#1c1c1e',
							borderTop: '1px solid rgba(255, 255, 255, 0.15)',
							borderRadius: '20px 20px 0 0',
							padding: '20px 18px calc(24px + env(safe-area-inset-bottom)) 18px',
							display: 'flex',
							flexDirection: 'column',
							gap: '14px',
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<span style={{ fontSize: '15px', fontWeight: 700 }}>{t('kasaTxDetailTitle')}</span>
							<button
								type="button"
								onClick={() => setSelectedRecord(null)}
								style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.6)', cursor: 'pointer' }}
							>
								<X size={18} />
							</button>
						</div>

						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px' }}>
							<div>
								<div style={{ fontSize: '15px', fontWeight: 700 }}>{selectedRecord.aciklama}</div>
								<div style={{ fontSize: '12px', opacity: 0.6 }}>{selectedRecord.kategori} • {formatDate(selectedRecord.date)}</div>
							</div>
							<div style={{ fontSize: '18px', fontWeight: 800, color: selectedRecord.tur === 'gelir' ? '#34c759' : '#ffffff' }}>
								{selectedRecord.tur === 'gelir' ? '+' : '-'}{tl(selectedRecord.tutarKurus)}
							</div>
						</div>

						{selectedRecord.fisFotoUrl && (
							<div>
								<span style={{ fontSize: '11.5px', opacity: 0.65, display: 'block', marginBottom: '6px' }}>{t('kasaReceiptAttached')}</span>
								<a
									href={selectedRecord.fisFotoUrl}
									target="_blank"
									rel="noreferrer noopener"
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '6px',
										color: 'var(--accent)',
										textDecoration: 'none',
										fontSize: '13px',
										fontWeight: 600,
									}}
								>
									<FileText size={16} />
									<span>{t('kasaViewReceipt')}</span>
									<ExternalLink size={13} />
								</a>
							</div>
						)}

						{ledger.canWrite && (
							<div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
								<button
									type="button"
									style={{
										flex: 1,
										height: '42px',
										borderRadius: '12px',
										border: '1px solid rgba(255, 59, 48, 0.3)',
										background: 'rgba(255, 59, 48, 0.12)',
										color: '#ff453a',
										fontSize: '13px',
										fontWeight: 700,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										gap: '6px',
										cursor: 'pointer',
									}}
									onClick={() => {
										const r = selectedRecord;
										setSelectedRecord(null);
										void ledger.remove(r);
									}}
								>
									<Trash2 size={15} />
									<span>{t('delete')}</span>
								</button>
							</div>
						)}
					</div>
				</div>
			)}

			{/* New Entry Modal */}
			{ledger.modal?.kind === 'new' && (
				<VaultEntryModal
					teamId={active?.teamId ?? null}
					netBakiyeKurus={ledger.summary?.netBakiyeKurus ?? 0}
					onClose={() => ledger.setModal(null)}
					onSaved={ledger.changed}
				/>
			)}

			{/* Transfer Modal */}
			{ledger.modal?.kind === 'transfer' && vaults && (
				<TransferModal
					vaults={vaults}
					initialSource={active?.teamId ?? null}
					onClose={() => ledger.setModal(null)}
					onSaved={ledger.changed}
				/>
			)}
		</div>
	);
}
