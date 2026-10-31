'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import ui from '@/core/ui/ui.module.css';
import k from './Kasa.module.css';
import type { VaultRecord, VaultSummary } from '../types';
import { useVaultLedger } from '../hooks/useKasaLedger';
import { VaultCardSummary } from './KasaCardSummary';
import { VaultInsights } from './KasaInsights';
import { VaultToolbar } from './KasaToolbar';
import { VaultLedgerTable } from './KasaLedgerTable';
import { VaultEntryModal } from './KasaEntryModal';
import { TransferModal } from './TransferModal';

export interface VaultPanelProps {
	/** The project whose kasa to show; `null` is the club's general kasa. */
	teamId: string | null;
	/** Called after an entry is added or removed, so a surrounding list can refresh its balances. */
	onChanged?: () => void;
	/** Drops the outer padding when the panel sits inside another screen. */
	embedded?: boolean;
	/** Every kasa the viewer may open; when given (management), allocations between them are offered. */
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
		tur,
		setTur,
		kategori,
		setKategori,
		ay,
		setAy,
		arama,
		setArama,
		modal,
		setModal,
		changed,
		remove,
		exportCsv,
		clearFilter,
		balances,
		dagilim,
		aylar,
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
						background: 'rgba(255, 59, 48, 0.08)',
						border: '1px solid rgba(255, 59, 48, 0.25)',
						borderRadius: 16,
						padding: '28px 24px',
					}}
				>
					<ShieldAlert size={40} color="#ff453a" style={{ marginBottom: 12 }} />
					<h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px 0' }}>
						{t('kasaNoAccessTitle')}
					</h3>
					<p style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5, margin: 0 }}>
						{t('kasaNoAccessBody')}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className={`${k.panel} ${embedded ? k.embedded : ''}`} data-focus-id={`kasa:${teamId ?? 'genel'}`}>
			<VaultCardSummary
				teamId={teamId}
				summary={summary}
				isLoading={isLoading}
				dagilimFirstCategory={dagilim[0]}
			/>

			{records.length > 0 && (
				<VaultInsights
					dagilim={dagilim}
					kategori={kategori}
					onSelectKategori={(c) => setKategori(c)}
					aylar={aylar}
					ay={ay}
					onSelectAy={(m) => setAy(m)}
					maxMonth={maxMonth}
				/>
			)}

			<VaultToolbar
				arama={arama}
				onAramaChange={setArama}
				tur={tur}
				onTurChange={setTur}
				kategori={kategori}
				onKategoriChange={setKategori}
				ay={ay}
				onAyChange={setAy}
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
					{t('kasaFilteredCount')
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
						{t('kasaClearFilter')}
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
					netBakiyeKurus={summary?.netBakiyeKurus ?? 0}
					onClose={() => setModal(null)}
					onSaved={changed}
				/>
			)}
			{modal?.kind === 'edit' && (
				<VaultEntryModal
					teamId={teamId}
					registration={modal.registration}
					netBakiyeKurus={summary?.netBakiyeKurus ?? 0}
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
