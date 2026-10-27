'use client';

import React from 'react';
import { Plus, Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface NewsToolbarProps {
	isAdmin: boolean;
	activeCategory: string;
	onSelectCategory: (cat: string) => void;
	searchQuery: string;
	onSearchChange: (q: string) => void;
	onOpenCreate: () => void;
}

export function NewsToolbar({
	isAdmin,
	activeCategory,
	onSelectCategory,
	searchQuery,
	onSearchChange,
	onOpenCreate,
}: NewsToolbarProps) {
	const { t } = useI18n();

	const tabs = [
		{ id: 'all', label: t('newsAll') },
		{ id: 'teknofest', label: t('newsCatTeknofestShort') },
		{ id: 'atolye', label: t('newsCatAtolyeShort') },
		{ id: 'isbirligi', label: t('newsCatIsbirligiShort') },
		{ id: 'resmi', label: t('newsCatResmiShort') },
	];

	return (
		<div
			style={{
				padding: '12px 20px',
				borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				gap: '16px',
				flexWrap: 'wrap',
				flexShrink: 0,
				background: 'rgba(0, 0, 0, 0.18)',
				backdropFilter: 'var(--glass-blur)',
			}}
		>
			<div
				className="no-scrollbar"
				style={{
					display: 'flex',
					gap: '8px',
					overflowX: 'auto',
					paddingBottom: '2px',
					scrollbarWidth: 'none',
					msOverflowStyle: 'none',
					WebkitOverflowScrolling: 'touch',
					flex: '1 1 auto',
					minWidth: 0,
				}}
			>
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => onSelectCategory(tab.id)}
						style={{
							padding: '6px 14px',
							borderRadius: '20px',
							fontSize: '12px',
							fontWeight: activeCategory === tab.id ? 700 : 500,
							border:
								activeCategory === tab.id
									? '1px solid var(--accent-border)'
									: '1px solid rgba(255, 255, 255, 0.08)',
							background:
								activeCategory === tab.id ? 'var(--accent-subtle)' : 'rgba(255, 255, 255, 0.04)',
							color: activeCategory === tab.id ? 'var(--accent)' : 'inherit',
							cursor: 'pointer',
							transition: 'all 120ms ease',
							whiteSpace: 'nowrap',
						}}
					>
						{tab.label}
					</button>
				))}
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px', minWidth: 0, justifyContent: 'flex-end' }}>
				<div style={{ position: 'relative', flex: 1, minWidth: '140px', maxWidth: '320px' }}>
					<Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', opacity: 0.5 }} />
					<input
						type="text"
						placeholder={t('newsSearchPlaceholder')}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						style={{
							width: '100%',
							padding: '7px 10px 7px 32px',
							borderRadius: '8px',
							border: '1px solid rgba(255, 255, 255, 0.1)',
							background: 'rgba(255, 255, 255, 0.05)',
							color: 'inherit',
							fontSize: '12px',
							outline: 'none',
							boxSizing: 'border-box',
						}}
					/>
				</div>

				{isAdmin && (
					<button
						type="button"
						onClick={onOpenCreate}
						title={t('newsPublishNew')}
						aria-label={t('newsPublishNew')}
						style={{
							width: '32px',
							height: '32px',
							borderRadius: '8px',
							border: 'none',
							background: 'var(--accent)',
							color: 'var(--accent-contrast, #ffffff)',
							cursor: 'pointer',
							display: 'grid',
							placeItems: 'center',
							boxShadow: 'var(--accent-glow)',
							transition: 'all 150ms ease',
							flexShrink: 0,
						}}
					>
						<Plus size={16} />
					</button>
				)}
			</div>
		</div>
	);
}
