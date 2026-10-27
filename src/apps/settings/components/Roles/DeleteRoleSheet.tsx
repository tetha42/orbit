'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { Trash2 } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import ui from '@/core/ui/ui.module.css';

export interface RolSummaryView {
	id: string;
	ad: string;
	kullaniciSayisi: number;
}

interface DeleteRoleSheetProps {
	role: RolSummaryView;
	hedefler: { id: string; ad: string }[];
	varsayilan: string | null;
	onClose: () => void;
	onDelete: (tasi: string | null) => Promise<void>;
}

export function DeleteRoleSheet({
	role,
	hedefler,
	varsayilan,
	onClose,
	onDelete,
}: DeleteRoleSheetProps) {
	const { t } = useI18n();
	const [tasi, setTasi] = useState<string>(
		varsayilan && varsayilan !== role.id && hedefler.some((r) => r.id === varsayilan)
			? varsayilan
			: ''
	);
	const [busy, setBusy] = useState(false);

	return (
		<Sheet
			title={fill(t('rolesDeleteTitle'), { name: role.ad })}
			label={fill(t('rolesDeleteTitle'), { name: role.ad })}
			icon={<Trash2 size={18} color="#ff453a" />}
			tone="danger"
			onClose={onClose}
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				await onDelete(tasi || null);
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
				{fill(t('rolesMembersInRole'), { n: role.kullaniciSayisi })}
			</p>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('rolesTargetRole')}</span>
				<select className={ui.select} value={tasi} onChange={(e) => setTasi(e.target.value)} aria-label={t('rolesTargetRoleAria')}>
					{hedefler.map((r) => (
						<option key={r.id} value={r.id}>
							{r.ad}
							{r.id === varsayilan ? ` (${t('defaultLabel')})` : ''}
						</option>
					))}
					<option value="">{t('rolesOnlyPersonal')}</option>
				</select>
			</label>
		</Sheet>
	);
}
