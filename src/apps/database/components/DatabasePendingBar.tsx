'use client';

import React from 'react';
import { Save, AlertCircle, Undo2, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { PendingCellChange } from '../types';
import s from '../Database.module.css';

interface DatabasePendingBarProps {
	pendingChanges: PendingCellChange[];
	isSaving: boolean;
	onDiscard: () => void;
	onSave: () => void;
}

export function DatabasePendingBar({
	pendingChanges,
	isSaving,
	onDiscard,
	onSave,
}: DatabasePendingBarProps) {
	const { t } = useI18n();

	if (pendingChanges.length === 0) return null;

	return (
		<div className={s.floatingBar}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
				<AlertCircle size={16} />
				<span>
					{fill(t('dbPendingChanges'), { n: pendingChanges.length })}
				</span>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<button
					type="button"
					className={s.discardBtn}
					onClick={onDiscard}
					disabled={isSaving}
					title={t('dbDiscardTitle')}
				>
					<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
						<Undo2 size={13} />
						<span>{t('dbDiscard')}</span>
					</span>
				</button>

				<button
					type="button"
					className={s.saveBtn}
					onClick={onSave}
					disabled={isSaving}
				>
					{isSaving ? (
						<>
							<Loader2 size={14} className="animate-spin" />
							<span>{t('saving')}</span>
						</>
					) : (
						<>
							<Save size={14} />
							<span>{t('dbApplyChanges')}</span>
						</>
					)}
				</button>
			</div>
		</div>
	);
}
