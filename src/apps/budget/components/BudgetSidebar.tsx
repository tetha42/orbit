'use client';

import React from 'react';
import { FolderGit2, Landmark } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { VaultSummary } from '../types';

interface BudgetSidebarProps {
	vaults: VaultSummary[];
	active: VaultSummary | undefined;
	general: VaultSummary[];
	projects: VaultSummary[];
	onSelect: (teamId: string | null) => void;
}

const formatTL = (minor: number) =>
	(minor / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sectionLabel: React.CSSProperties = {
	fontSize: '10.5px',
	fontWeight: 700,
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	opacity: 0.5,
	padding: '10px 10px 6px',
};

export function BudgetSidebar({ active, general, projects, onSelect }: BudgetSidebarProps) {
	const { t } = useI18n();

	const renderItem = (vault: VaultSummary) => {
		const isActive = active && vault.teamId === active.teamId;
		const Icon = vault.kind === 'general' ? Landmark : FolderGit2;
		return (
			<button
				key={vault.teamId ?? 'general'}
				className="vault-item"
				data-focus-id={`vault-item:${vault.teamId ?? 'general'}`}
				onClick={() => onSelect(vault.teamId)}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '10px',
					padding: '8px 12px',
					minHeight: '28px',
					borderRadius: '6px',
					border: 'none',
					background: isActive ? 'var(--accent)' : 'transparent',
					color: isActive ? 'var(--accent-contrast, #ffffff)' : 'inherit',
					textAlign: 'left',
					cursor: 'pointer',
				}}
			>
				<Icon
					size={16}
					color={isActive ? '#ffffff' : undefined}
					style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}
				/>
				<span style={{ flex: 1, minWidth: 0 }}>
					<span
						style={{
							display: 'block',
							fontSize: '12.5px',
							fontWeight: 600,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{vault.name}
					</span>
					<span style={{ display: 'block', fontSize: '11px', opacity: isActive ? 0.85 : 0.6 }}>
						{t('kasaEntryCount').replace('{n}', String(vault.recordCount))}
					</span>
				</span>
				<span
					style={{
						fontSize: '12px',
						fontWeight: 700,
						color: isActive ? '#ffffff' : (vault.netBalanceMinor > 0 ? '#34c759' : 'inherit'),
						opacity: isActive ? 1 : (vault.netBalanceMinor > 0 ? 1 : 0.55),
						whiteSpace: 'nowrap',
					}}
				>
					₺{formatTL(vault.netBalanceMinor)}
				</span>
			</button>
		);
	};

	return (
		<nav aria-label="Kasalar" className="vault-nav">
			<div className="vault-nav-label" style={sectionLabel}>
				{t('kasaGeneral')}
			</div>
			{general.map(renderItem)}
			<div className="vault-nav-label" style={sectionLabel}>
				{t('kasaProjectTreasuries')}
			</div>
			{projects.map(renderItem)}
			{projects.length === 0 && (
				<div className="vault-nav-label" style={{ padding: '4px 10px', fontSize: '12px', opacity: 0.55 }}>
					{t('kasaNoProjects')}
				</div>
			)}
		</nav>
	);
}
