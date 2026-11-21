'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import ui from '@/core/ui/ui.module.css';
import k from './Vault.module.css';
import type { VaultRecord, VaultSummary } from '../types';
import { useVaultLedger } from '../hooks/useVaultLedger';
import { VaultCardSummary } from './VaultCardSummary';
import { VaultInsights } from './VaultInsights';
import { VaultToolbar } from './VaultToolbar';
import { VaultLedgerTable } from './VaultLedgerTable';
import { VaultEntryModal } from './VaultEntryModal';
import { TransferModal } from './TransferModal';

export interface VaultPanelProps {
	/** The project whose vault to show; `null` is the community's general vault. */
	teamId: string | null;
	/** Called after an entry is added or removed, so a surrounding list can refresh its balances. */
	onChanged?: () => void;
	/** Drops the outer padding when the panel sits inside another screen. */
	embedded?: boolean;
	/** Every vault the viewer may open; when given (management), allocations between them are offered. */
	vaults?: VaultSummary[];
}

export function VaultPanel({ teamId, onChanged, embedded = false, vaults }: VaultPanelProps) {
	const {
		t,
		records,
		summary,
		isLoading,
		httpStatus,
		canWrite,
		isManagement,
		canTransfer,
		typeFilter,
		setTypeFilter,
		category,
		setCategory,
		month,
		setMonth,
		search,
		setSearch,
		modal,
		setModal,
		changed,
		remove,
		exportCsv,
		clearFilter,
		balances,
		distribution,
		months,
		monthOptions,
		filtered,
		filteredIn,
		filteredOut,
		anyFilter,
		maxMonth,
	} = useVaultLedger({ teamId, onChanged, embedded, vaults });

	if (httpStatus === 403) {
		return (
			<div style={{ display: 'grid', placeItems: 'center', padding: '40px 20px', textAlign: 'center' }}>
				<div
					style={{
						maxWidth: 420,
						background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
						border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
						borderRadius: 16,
						padding: '28px 24px',
					}}
				>
					<ShieldAlert size={40} color="var(--danger)" style={{ marginBottom: 12 }} />
					<h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px 0' }}>
						{t('treasuryNoAccessTitle')}
					</h3>
					<p style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5, margin: 0 }}>
						{t('treasuryNoAccessBody')}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={`${k.panel} ${embedded ? k.embedded : ''}`} data-focus-id={`vault:${teamId ?? 'general'}`}>
			<VaultCardSummary
				teamId={teamId}
				summary={summary}
				isLoading={isLoading}
				distributionFirstCategory={distribution[0]}
			/>

			{records.length > 0 && (
				<VaultInsights
					distribution={distribution}
					category={category}
					onSelectCategory={(c) => setCategory(c)}
					months={months}
					month={month}
					onSelectMonth={(m) => setMonth(m)}
					maxMonth={maxMonth}
				/>
			)}

			<VaultToolbar
				search={search}
				onSearchChange={setSearch}
				typeFilter={typeFilter}
				onTypeChange={setTypeFilter}
				category={category}
				onCategoryChange={setCategory}
				month={month}
				onMonthChange={setMonth}
				monthOptions={monthOptions}
				canWrite={canWrite}
				canTransfer={canTransfer}
				hasFilteredRecords={filtered.length > 0}
				onExportCsv={exportCsv}
				onOpenTransfer={() => setModal({ kind: 'transfer' })}
				onOpenNewEntry={() => setModal({ kind: 'new' })}
			/>

			{anyFilter && (
				<div className={k.filterNote}>
					{t('treasuryFilteredCount')
						.replace('{count}', String(filtered.length))
						.replace('{total}', String(records.length))
						.replace('{in}', `₺${filteredIn / 100}`)
						.replace('{out}', `₺${filteredOut / 100}`)}{' '}
					<button
						type="button"
						className={ui.btn}
						style={{ padding: '2px 8px', fontSize: 11.5 }}
						onClick={clearFilter}
					>
						{t('treasuryClearFilter')}
					</button>
				</div>
			)}

			<VaultLedgerTable
				records={records}
				filtered={filtered}
				balances={balances}
				isLoading={isLoading}
				canWrite={canWrite}
				isManagement={isManagement}
				anyFilter={anyFilter}
				filteredIn={filteredIn}
				filteredOut={filteredOut}
				onEdit={(registration: VaultRecord) => setModal({ kind: 'edit', registration })}
				onDelete={remove}
			/>

			{modal?.kind === 'new' && (
				<VaultEntryModal
					teamId={teamId}
					netBalanceMinor={summary?.netBalanceMinor ?? 0}
					onClose={() => setModal(null)}
					onSaved={changed}
				/>
			)}
			{modal?.kind === 'edit' && (
				<VaultEntryModal
					teamId={teamId}
					registration={modal.registration}
					netBalanceMinor={summary?.netBalanceMinor ?? 0}
					onClose={() => setModal(null)}
					onSaved={changed}
				/>
			)}
			{modal?.kind === 'transfer' && vaults && (
				<TransferModal
					vaults={vaults}
					initialSource={teamId}
					onClose={() => setModal(null)}
					onSaved={changed}
				/>
			)}
		</div>
	);
}
