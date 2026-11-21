'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { GROUP_LABEL_KEYS, type SpotlightGroup, type SpotlightRow } from './spotlightTypes';

interface SpotlightResultsListProps {
	listRef: React.RefObject<HTMLDivElement | null>;
	listId: string;
	optionId: (rowId: string) => string;
	groups: SpotlightGroup[];
	activeIndex: number;
	empty: boolean;
	isSearching: boolean;
	onChoose: (row: SpotlightRow) => void;
	onHoverRow: (rowId: string) => void;
}

export function SpotlightResultsList({
	listRef,
	listId,
	optionId,
	groups,
	activeIndex,
	empty,
	isSearching,
	onChoose,
	onHoverRow,
}: SpotlightResultsListProps) {
	const { t } = useI18n();
	const indexedGroups = groups.reduce<Array<{ group: SpotlightGroup; offset: number }>>((acc, group) => {
		const prev = acc[acc.length - 1];
		const offset = prev ? prev.offset + prev.group.rows.length : 0;
		acc.push({ group, offset });
		return acc;
	}, []);

	return (
		<div
			ref={listRef}
			id={listId}
			role="listbox"
			aria-label={t('spotResultsLabel')}
			style={{ maxHeight: 'min(420px, 52vh)', overflowY: 'auto', padding: '6px' }}
		>
			{indexedGroups.map(({ group, offset }) => (
				<div key={group.id} role="group" aria-label={t(GROUP_LABEL_KEYS[group.id])}>
					<div
						aria-hidden="true"
						style={{
							fontSize: '10.5px',
							fontWeight: 700,
							letterSpacing: '0.08em',
							textTransform: 'uppercase',
							opacity: 0.5,
							padding: '10px 14px 4px',
						}}
					>
						{t(GROUP_LABEL_KEYS[group.id])}
					</div>
					{group.rows.map((row, localIdx) => {
						const isActive = offset + localIdx === activeIndex;
						return (
							<div
								key={row.id}
								id={optionId(row.id)}
								role="option"
								aria-selected={isActive}
								data-active={isActive}
								onClick={() => onChoose(row)}
								onMouseMove={() => {
									if (!isActive) onHoverRow(row.id);
								}}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									gap: '12px',
									padding: '9px 14px',
									borderRadius: '10px',
									background: isActive ? 'var(--accent-blue, var(--accent))' : 'transparent',
									color: isActive ? '#ffffff' : 'inherit',
									cursor: 'pointer',
									opacity: row.stale ? 0.55 : 1,
									transition: 'background 80ms ease, opacity 120ms ease',
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
									<div
										style={{
											width: '32px',
											height: '32px',
											flexShrink: 0,
											borderRadius: '8px',
											background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--fill-soft)',
											display: 'grid',
											placeItems: 'center',
										}}
									>
										{row.icon}
									</div>
									<div style={{ minWidth: 0 }}>
										<div
											style={{
												fontSize: '13.5px',
												fontWeight: 600,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}
										>
											{row.title}
										</div>
										{row.subtitle && (
											<div
												style={{
													fontSize: '11px',
													opacity: isActive ? 0.85 : 0.6,
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap',
												}}
											>
												{row.subtitle}
											</div>
										)}
									</div>
								</div>

								<span
									style={{
										flexShrink: 0,
										fontSize: '11px',
										opacity: isActive ? 0.9 : 0.5,
										background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--fill-soft)',
										padding: '2px 8px',
										borderRadius: '10px',
									}}
								>
									{row.badge}
								</span>
							</div>
						);
					})}
				</div>
			))}

			{empty && (
				<div style={{ padding: '32px 16px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
					{isSearching ? t('spotSearching') : t('spotNoResults')}
				</div>
			)}
		</div>
	);
}
