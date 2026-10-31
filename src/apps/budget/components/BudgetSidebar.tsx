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

const formatTL = (kurus: number) =>
	(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

	const renderItem = (kasa: VaultSummary) => {
		const isActive = active && kasa.teamId === active.teamId;
		const Icon = kasa.kind === 'genel' ? Landmark : FolderGit2;
		return (
			<button
				key={kasa.teamId ?? 'genel'}
				className="kasa-item"
				data-focus-id={`kasa-item:${kasa.teamId ?? 'genel'}`}
				onClick={() => onSelect(kasa.teamId)}
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
						{kasa.ad}
					</span>
					<span style={{ display: 'block', fontSize: '11px', opacity: isActive ? 0.85 : 0.6 }}>
						{t('kasaEntryCount').replace('{n}', String(kasa.kayitSayisi))}
					</span>
				</span>
				<span
					style={{
						fontSize: '12px',
						fontWeight: 700,
						color: isActive ? '#ffffff' : (kasa.netBakiyeKurus > 0 ? '#34c759' : 'inherit'),
						opacity: isActive ? 1 : (kasa.netBakiyeKurus > 0 ? 1 : 0.55),
						whiteSpace: 'nowrap',
					}}
				>
					₺{formatTL(kasa.netBakiyeKurus)}
				</span>
			</button>
		);
	};

	return (
		<nav aria-label="Kasalar" className="kasa-nav">
			<div className="kasa-nav-label" style={sectionLabel}>
				{t('kasaGeneral')}
			</div>
			{general.map(renderItem)}
			<div className="kasa-nav-label" style={sectionLabel}>
				{t('kasaProjectTreasuries')}
			</div>
			{projects.map(renderItem)}
			{projects.length === 0 && (
				<div className="kasa-nav-label" style={{ padding: '4px 10px', fontSize: '12px', opacity: 0.55 }}>
					{t('kasaNoProjects')}
				</div>
			)}
		</nav>
	);
}
