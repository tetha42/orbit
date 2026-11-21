'use client';

import React from 'react';
import { ArrowLeftRight, Check, Landmark, Wallet } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import type { VaultSummary } from '../../types';
import s from '../BudgetMobile.module.css';

const tl = (minor: number) => `₺${formatMinor(minor)}`;

interface BudgetMobileWalletsTabProps {
	active: VaultSummary | undefined;
	general: VaultSummary[];
	projects: VaultSummary[];
	canTransfer: boolean;
	onSelect: (teamId: string | null) => void;
	onOpenTransfer: () => void;
}

export function BudgetMobileWalletsTab({
	active,
	general,
	projects,
	canTransfer,
	onSelect,
	onOpenTransfer,
}: BudgetMobileWalletsTabProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
				<div>
					<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('treasuryMobTabWallets')}</h3>
					<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>{t('treasurySelectActiveNotice')}</p>
				</div>
				{canTransfer && (
					<button
						type="button"
						className={s.chip}
						style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
						onClick={onOpenTransfer}
					>
						<ArrowLeftRight size={13} />
						<span>{t('treasuryTransferBtn')}</span>
					</button>
				)}
			</div>

			{/* General Treasury Section */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				<div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.04em' }}>
					{t('treasuryGeneralTitle')}
				</div>
				{general.map((k) => {
					const isCurrent = active?.teamId === k.teamId;
					return (
						<div
							key={k.teamId ?? 'general'}
							className={`${s.walletCard} ${isCurrent ? s.walletCardActive : ''}`}
							onClick={() => onSelect(k.teamId)}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
								<div
									style={{
										width: '40px',
										height: '40px',
										borderRadius: '12px',
										background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
										color: 'var(--accent)',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<Landmark size={20} />
								</div>
								<div>
									<div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{k.name}</div>
									<div style={{ fontSize: '11.5px', opacity: 0.6 }}>{t('treasuryGeneralDesc')}</div>
								</div>
							</div>

							<div style={{ textAlign: 'right' }}>
								<div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>
									{tl(k.netBalanceMinor)}
								</div>
								{isCurrent && (
									<span className={`${s.badge} ${s.badgeOk}`} style={{ marginTop: '4px' }}>
										<Check size={11} strokeWidth={2.5} /> {t('treasuryActiveBadge')}
									</span>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Project Treasuries Section */}
			{projects.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
					<div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.04em' }}>
						{t('treasuryProjectsTitle')} ({projects.length})
					</div>
					{projects.map((k) => {
						const isCurrent = active?.teamId === k.teamId;
						return (
							<div
								key={k.teamId ?? 'project'}
								className={`${s.walletCard} ${isCurrent ? s.walletCardActive : ''}`}
								onClick={() => onSelect(k.teamId)}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
									<div
										style={{
											width: '40px',
											height: '40px',
											borderRadius: '12px',
											background: 'color-mix(in srgb, var(--success) 15%, transparent)',
											color: 'var(--success)',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<Wallet size={20} />
									</div>
									<div>
										<div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{k.name}</div>
										<div style={{ fontSize: '11.5px', opacity: 0.6 }}>{t('treasuryProjectDesc')}</div>
									</div>
								</div>

								<div style={{ textAlign: 'right' }}>
									<div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>
										{tl(k.netBalanceMinor)}
									</div>
									{isCurrent && (
										<span className={`${s.badge} ${s.badgeOk}`} style={{ marginTop: '4px' }}>
											<Check size={11} strokeWidth={2.5} /> {t('treasuryActiveBadge')}
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
}
