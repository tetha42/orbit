'use client';

import React from 'react';
import { useIsMobile } from '@/lib/client/useClientValue';
import s from './components/Inventory.module.css';
import { useInventory } from './hooks/useInventory';
import { InventoryToolbar } from './components/InventoryToolbar';
import { InventoryGrid } from './components/InventoryGrid';
import { ItemDetailModal } from './components/ItemDetailModal';
import { ItemFormModal } from './components/ItemFormModal';
import { LoanModal } from './components/LoanModal';
import { InventoryMobileView } from './components/InventoryMobileView';

/**
 * The club's lab inventory: what exists, where it is, who has it and until when.
 * Clean modularized container (<90 lines).
 */
export function InventoryApp() {
	const isMobile = useIsMobile();
	const inv = useInventory();

	if (isMobile) {
		return <InventoryMobileView inv={inv} />;
	}

	const {
		currentUserId,
		isManager,
		isMezun,
		now,
		data,
		items,
		filter,
		setFilter,
		kategori,
		setKategori,
		arama,
		setArama,
		detailId,
		setDetailId,
		loan,
		setLoan,
		form,
		setForm,
		done,
		counts,
		categories,
		visible,
		byId,
	} = inv;

	const detail = byId(detailId);
	const loanItem = loan ? byId(loan.id) : null;
	const formItem = form?.id ? byId(form.id) : null;

	return (
		<div className={s.app}>
			<div className={s.inner}>
				<InventoryToolbar
					filter={filter}
					setFilter={setFilter}
					arama={arama}
					setArama={setArama}
					kategori={kategori}
					setKategori={setKategori}
					categories={categories}
					counts={counts}
					isManager={isManager}
					onNewItem={() => setForm({ id: null })}
				/>

				<InventoryGrid
					data={data}
					visible={visible}
					totalCount={items.length}
					currentUserId={currentUserId}
					isManager={isManager}
					isMezun={isMezun}
					now={now}
					onDetail={(id) => setDetailId(id)}
					onLoan={(loanState) => setLoan(loanState)}
				/>
			</div>

			{detail && (
				<ItemDetailModal
					item={detail}
					selfId={currentUserId}
					isManager={isManager}
					isMezun={isMezun}
					now={now}
					onClose={() => setDetailId(null)}
					onEdit={() => {
						setDetailId(null);
						setForm({ id: detail.id });
					}}
					onLoan={(mode) => {
						setDetailId(null);
						setLoan({ id: detail.id, mode });
					}}
					onChanged={(msg, err) => done(msg, err)}
				/>
			)}

			{form && (
				<ItemFormModal
					item={formItem ?? undefined}
					onClose={() => setForm(null)}
					onSaved={(msg) => done(msg)}
				/>
			)}

			{loanItem && loan && (
				<LoanModal
					item={loanItem}
					mode={loan.mode}
					selfId={currentUserId}
					isManager={isManager}
					onClose={() => setLoan(null)}
					onDone={(msg) => done(msg)}
				/>
			)}
		</div>
	);
}

export default InventoryApp;
