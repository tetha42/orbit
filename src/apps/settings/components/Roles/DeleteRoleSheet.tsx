'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { Trash2 } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import ui from '@/core/ui/ui.module.css';

export interface RoleSummaryView {
	id: string;
	name: string;
	userCount: number;
}

interface DeleteRoleSheetProps {
	role: RoleSummaryView;
	targets: { id: string; name: string }[];
	defaultValue: string | null;
	onClose: () => void;
	onDelete: (move: string | null) => Promise<void>;
}

export function DeleteRoleSheet({
	role,
	targets,
	defaultValue,
	onClose,
	onDelete,
}: DeleteRoleSheetProps) {
	const { t } = useI18n();
	const [move, setMove] = useState<string>(
		defaultValue && defaultValue !== role.id && targets.some((r) => r.id === defaultValue)
			? defaultValue
			: ''
	);
	const [busy, setBusy] = useState(false);

	return (
		<Sheet
			title={fill(t('rolesDeleteTitle'), { name: role.name })}
			label={fill(t('rolesDeleteTitle'), { name: role.name })}
			icon={<Trash2 size={18} color="var(--danger)" />}
			tone="danger"
			onClose={onClose}
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				await onDelete(move || null);
				setBusy(false);
			}}
			maxWidth={460}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('cancel')}
					</button>
					<button type="submit" className={`${ui.btn} ${ui.btnDanger}`} disabled={busy}>
						{busy ? t('rolesDeleting') : t('rolesMigrateAndDel')}
					</button>
				</>
			}
		>
			<p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
				{fill(t('rolesMembersInRole'), { n: role.userCount })}
			</p>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('rolesTargetRole')}</span>
				<select className={ui.select} value={move} onChange={(e) => setMove(e.target.value)} aria-label={t('rolesTargetRoleAria')}>
					{targets.map((r) => (
						<option key={r.id} value={r.id}>
							{r.name}
							{r.id === defaultValue ? ` (${t('defaultLabel')})` : ''}
						</option>
					))}
					<option value="">{t('rolesOnlyPersonal')}</option>
				</select>
			</label>
		</Sheet>
	);
}
