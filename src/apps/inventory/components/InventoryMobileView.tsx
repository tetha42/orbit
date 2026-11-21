'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Package, Clock, UserCheck, PlusCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { useInventory } from '../hooks/useInventory';
import { ItemDetailModal } from './ItemDetailModal';
import { LoanModal } from './LoanModal';
import { ItemFormModal } from './ItemFormModal';
import { InventoryMobileItemsTab } from './mobile/InventoryMobileItemsTab';
import { InventoryMobileLoansTab } from './mobile/InventoryMobileLoansTab';
import { InventoryMobileMineTab } from './mobile/InventoryMobileMineTab';
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
		() => inv.items.filter((i) => i.status === 'on_loan'),
		[inv.items]
	);

	const myItems = useMemo(
		() => inv.items.filter((i) => i.status === 'on_loan' && i.holderUserId === inv.currentUserId),
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
			badgeCount: inv.counts.overdue > 0 ? inv.counts.overdue : undefined,
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

	return (
		<div className={s.mobileRoot}>
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'items' && <InventoryMobileItemsTab inv={inv} />}
				{activeTab === 'loans' && (
					<InventoryMobileLoansTab
						loading={inv.data === null}
						loanedItems={loanedItems}
						now={inv.now}
						onSelect={(id) => inv.setDetailId(id)}
					/>
				)}
				{activeTab === 'mine' && (
					<InventoryMobileMineTab
						loading={inv.data === null}
						myItems={myItems}
						now={inv.now}
						onReturn={(id) => inv.setLoan({ id, mode: 'return' })}
					/>
				)}
			</div>

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
