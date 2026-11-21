'use client';

import React from 'react';
import { FileText, Lock, Plus, Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import { documentRef } from './documentMeta';
import type { Decision } from './types';

interface DecisionListProps {
	decisions: Decision[];
	selectedId: string | null;
	query: string;
	canManage: boolean;
	onQueryChange: (value: string) => void;
	onSelect: (id: string) => void;
	onNew: () => void;
	formatDate: (value: number) => string;
}

/** The archive's left column: search, the New Document button and one row per document. */
export function DecisionList({
	decisions,
	selectedId,
	query,
	canManage,
	onQueryChange,
	onSelect,
	onNew,
	formatDate,
}: DecisionListProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: '10px' }} data-decision-list>
			<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
				<label style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
					<Search size={14} style={{ position: 'absolute', left: 9, opacity: 0.55, pointerEvents: 'none' }} />
					<input
						type="search"
						className={ui.input}
						style={{ paddingLeft: 28 }}
						placeholder={t('decisionsSearchPlaceholder')}
						aria-label={t('decisionsSearchPlaceholder')}
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
					/>
				</label>
				{canManage && (
					<button type="button" className={ui.primaryBtn} onClick={onNew} style={{ whiteSpace: 'nowrap' }}>
						<Plus size={14} /> {t('decisionsNewDoc')}
					</button>
				)}
			</div>

			{!canManage && (
				<div
					data-decision-readonly
					style={{
						fontSize: 11,
						fontWeight: 700,
						letterSpacing: '0.02em',
						color: 'var(--text-secondary)',
						padding: '3px 8px',
						borderRadius: 6,
						background: 'color-mix(in srgb, var(--text-primary) 7%, transparent)',
						alignSelf: 'flex-start',
					}}
				>
					{t('decisionsReadOnly')}
				</div>
			)}

			<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', minHeight: 0 }}>
				{decisions.length === 0 ? (
					<div className={ui.muted} style={{ fontSize: 12, padding: '14px 4px' }}>
						{t('decisionsEmpty')}
					</div>
				) : (
					decisions.map((decision) => {
						const locked = Number(decision.isLocked) === 1;
						const selected = decision.id === selectedId;
						return (
							<button
								key={decision.id}
								type="button"
								data-focus-id={`decision:${decision.id}`}
								onClick={() => onSelect(decision.id)}
								style={{
									textAlign: 'left',
									border: `1px solid ${selected ? 'color-mix(in srgb, var(--accent) 60%, transparent)' : 'var(--window-border)'}`,
									background: selected ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'rgba(255,255,255,0.025)',
									borderRadius: 9,
									padding: '9px 11px',
									cursor: 'pointer',
									color: 'inherit',
									display: 'flex',
									flexDirection: 'column',
									gap: 4,
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.75 }}>
									<FileText size={12} />
									<span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
										{t('decisionsDocRef')} {documentRef(decision.referenceNumber)}
									</span>
									{locked && (
										<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto', color: 'var(--warning)' }}>
											<Lock size={11} /> {t('decisionsLocked')}
										</span>
									)}
								</div>
								<strong style={{ fontSize: 12.5, lineHeight: 1.3 }}>{decision.title}</strong>
								<div style={{ fontSize: 11, opacity: 0.6 }}>{formatDate(decision.date)}</div>
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}
