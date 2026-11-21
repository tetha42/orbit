'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import type { VaultRecord } from '../types';
import { VaultTableRow } from './VaultTableRow';
import { VaultMobileCard } from './VaultMobileCard';
import k from './Vault.module.css';

interface VaultLedgerTableProps {
	records: VaultRecord[];
	filtered: VaultRecord[];
	balances: Map<string, number>;
	isLoading: boolean;
	canWrite: boolean;
	isManagement: boolean;
	anyFilter: boolean;
	filteredIn: number;
	filteredOut: number;
	onEdit: (r: VaultRecord) => void;
	onDelete: (r: VaultRecord) => void;
}

const tl = (minor: number) => `₺${formatMinor(minor)}`;

export function VaultLedgerTable({
	records,
	filtered,
	balances,
	isLoading,
	canWrite,
	isManagement,
	anyFilter,
	filteredIn,
	filteredOut,
	onEdit,
	onDelete,
}: VaultLedgerTableProps) {
	const { t, language } = useI18n();
	const [isMobile, setIsMobile] = React.useState(false);

	React.useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	if (isMobile) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', padding: '10px 14px 32px' }}>
				{filtered.length === 0 && (
					<div style={{ padding: '36px 16px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
						{isLoading ? t('loading') : records.length === 0 ? t('treasuryEmptyLedger') : t('treasuryNoMatch')}
					</div>
				)}
				{filtered.map((r) => {
					const transfer = !!r.transferId;
					const lockedForMe = !canWrite || (transfer && !isManagement);
					return <VaultMobileCard key={r.id} r={r} lockedForMe={lockedForMe} onEdit={onEdit} onDelete={onDelete} />;
				})}
			</div>
		);
	}

	return (
		<div className={k.ledger} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
			<table className={k.table} style={{ minWidth: '650px' }}>
				<thead>
					<tr>
						<th>{t('budgetColDate')}</th>
						<th>{t('budgetColType')}</th>
						<th>{t('budgetColCategory')}</th>
						<th style={{ width: '40%' }}>{t('budgetColTitle')}</th>
						<th className={k.colUser}>{t('budgetColUser')}</th>
						<th className={k.num}>{t('budgetColAmount')}</th>
						<th className={`${k.num} ${k.colBalance}`}>{t('treasuryBalance')}</th>
						<th aria-label={t('actions')} />
					</tr>
				</thead>
				<tbody>
					{filtered.length === 0 && (
						<tr>
							<td colSpan={8} className={k.emptyRow}>
								{isLoading ? t('loading') : records.length === 0 ? t('treasuryEmptyLedger') : t('treasuryNoMatch')}
							</td>
						</tr>
					)}
					{filtered.map((r) => {
						const transfer = !!r.transferId;
						const lockedForMe = !canWrite || (transfer && !isManagement);
						return (
							<VaultTableRow
								key={r.id}
								r={r}
								balance={balances.get(r.id) ?? 0}
								lockedForMe={lockedForMe}
								language={language}
								onEdit={onEdit}
								onDelete={onDelete}
							/>
						);
					})}
				</tbody>
				{filtered.length > 0 && anyFilter && (
					<tfoot>
						<tr className={k.foot}>
							<td colSpan={5}>{t('treasuryFilteredTotal').replace('{n}', String(filtered.length))}</td>
							<td className={`${k.num} ${filteredIn - filteredOut >= 0 ? k.pos : k.neg}`}>
								{filteredIn - filteredOut >= 0 ? '+' : '−'}
								{tl(Math.abs(filteredIn - filteredOut))}
							</td>
							<td className={k.colBalance} />
							<td />
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}
