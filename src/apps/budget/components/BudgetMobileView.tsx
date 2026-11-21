'use client';

import React, { useState, useRef } from 'react';
import { Receipt, Wallet, PieChart, PlusCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { VaultSummary, VaultRecord } from '../types';
import { useVaultLedger } from '../hooks/useVaultLedger';
import { VaultInsights } from './VaultInsights';
import { VaultEntryModal } from './VaultEntryModal';
import { TransferModal } from './TransferModal';
import { BudgetMobileTransactionsTab } from './mobile/BudgetMobileTransactionsTab';
import { BudgetMobileWalletsTab } from './mobile/BudgetMobileWalletsTab';
import { BudgetRecordDetailSheet } from './mobile/BudgetRecordDetailSheet';
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
		{ id: 'transactions', label: t('treasuryMobTabTransactions'), Icon: Receipt },
		{ id: 'wallets', label: t('treasuryMobTabWallets'), Icon: Wallet },
		{ id: 'insights', label: t('treasuryMobTabInsights'), Icon: PieChart },
		{ id: 'add', label: t('treasuryMobAddEntry'), Icon: PlusCircle },
	];

	return (
		<div className={s.mobileRoot}>
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'transactions' && (
					<BudgetMobileTransactionsTab
						active={active}
						netBalanceMinor={ledger.summary?.netBalanceMinor ?? 0}
						totalIncomeMinor={ledger.summary?.totalIncomeMinor ?? 0}
						totalExpenseMinor={ledger.summary?.totalExpenseMinor ?? 0}
						search={ledger.search}
						onSearchChange={ledger.setSearch}
						typeFilter={ledger.typeFilter}
						onTypeChange={ledger.setTypeFilter}
						totalCount={ledger.records.length}
						filtered={ledger.filtered}
						isLoading={ledger.isLoading}
						onSelectRecord={setSelectedRecord}
					/>
				)}
				{activeTab === 'wallets' && (
					<BudgetMobileWalletsTab
						active={active}
						general={general}
						projects={projects}
						canTransfer={ledger.canTransfer}
						onSelect={onSelect}
						onOpenTransfer={() => ledger.setModal({ kind: 'transfer' })}
					/>
				)}
				{activeTab === 'insights' && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
						<div className={s.card}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<span style={{ fontSize: '13px', fontWeight: 700 }}>{t('treasuryInsightsTitle')}</span>
								<span style={{ fontSize: '11.5px', opacity: 0.6 }}>{active?.name}</span>
							</div>
							<VaultInsights
								distribution={ledger.distribution}
								category={ledger.category}
								onSelectCategory={(c) => ledger.setCategory(c)}
								months={ledger.months}
								month={ledger.month}
								onSelectMonth={(a) => ledger.setMonth(a)}
								maxMonth={ledger.maxMonth}
							/>
						</div>
					</div>
				)}
			</div>

			<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('treasuryMobNavAria')}>
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

			{selectedRecord && (
				<BudgetRecordDetailSheet
					record={selectedRecord}
					canWrite={ledger.canWrite}
					onClose={() => setSelectedRecord(null)}
					onRemove={(r) => {
						setSelectedRecord(null);
						void ledger.remove(r);
					}}
				/>
			)}

			{ledger.modal?.kind === 'new' && (
				<VaultEntryModal
					teamId={active?.teamId ?? null}
					netBalanceMinor={ledger.summary?.netBalanceMinor ?? 0}
					onClose={() => ledger.setModal(null)}
					onSaved={ledger.changed}
				/>
			)}

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
