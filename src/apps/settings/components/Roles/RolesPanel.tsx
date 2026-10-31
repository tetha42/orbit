'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { Plus, ShieldCheck } from 'lucide-react';
import { useJsonResource, invalidateResource } from '@/core/data/useJsonResource';
import { sendJson } from '@/core/data/http';
import { useToast } from '@/core/ui/Toast';
import { useDialog } from '@/components/Common/DialogProvider';
import ui from '@/core/ui/ui.module.css';
import { isAlumniRole, type Permissions } from '@/core/permissions';
import { RolesList } from './RolesList';
import { RoleEditor, type RoleView } from './RoleEditor';
import { DeleteRoleSheet } from './DeleteRoleSheet';
import s from './Roles.module.css';

interface RolesResponse {
	roller: RoleView[];
	varsayilanRolId: string | null;
	benimIzinlerim: Permissions;
}

export function RolesPanel() {
	const { t } = useI18n();
	const notify = useToast();
	const dialog = useDialog();
	const { data, refetch, httpStatus } = useJsonResource<RolesResponse>('/api/roles');
	const [editing, setEditing] = useState<RoleView | 'new' | null>(null);
	const [deleting, setDeleting] = useState<RoleView | null>(null);

	if (httpStatus === 403) return <div className={ui.error}>{t('rolesUnauthorized')}</div>;
	if (!data) return <div className={ui.muted}>{t('rolesLoading')}</div>;

	const remove = async (shown: RoleView) => {
		const fresh = await fetch('/api/roles')
			.then((r) => (r.ok ? (r.json() as Promise<RolesResponse>) : null))
			.catch(() => null);
		const role = fresh?.roller.find((r) => r.id === shown.id) ?? shown;
		if (role.kullaniciSayisi > 0) return setDeleting(role);
		if (!(await dialog.confirm({ message: fill(t('rolesDeleteConfirm'), { name: role.ad }), tone: 'danger' }))) return;
		await deleteRole(role, null);
	};

	const deleteRole = async (role: RoleView, tasi: string | null) => {
		const res = await sendJson('/api/roles', 'DELETE', { id: role.id, tasi });
		if (res.ok) {
			notify(t('rolesDeleted'));
			invalidateResource('/api/roles');
		} else {
			notify(res.error || t('rolesDeleteFailed'), 'error');
		}
		setDeleting(null);
		await refetch();
	};

	const setDefault = async (roleId: string) => {
		const res = await sendJson('/api/roles', 'POST', { action: 'varsayilan', roleId: roleId || null });
		if (res.ok) {
			notify(t('rolesUpdatedDefault'));
			invalidateResource('/api/roles');
		} else {
			notify(res.error || t('rolesSaveFailed'), 'error');
		}
		await refetch();
	};

	return (
		<div className={s.panel}>
			<div className={s.head}>
				<div>
					<h3 className={s.title}>
						<ShieldCheck size={18} /> {t('rolesTitle')}
					</h3>
					<p className={ui.muted} style={{ margin: '4px 0 0', fontSize: 12.5 }}>
						{t('rolesExplainer')}
					</p>
				</div>
				<button type="button" className={ui.primaryBtn} onClick={() => setEditing('new')}>
					<Plus size={15} /> {t('rolesCreateBtn')}
				</button>
			</div>

			<label className={s.defaultRow}>
				<span>{t('rolesDefaultMemberRole')}</span>
				<select
					className={ui.select}
					style={{ maxWidth: 260 }}
					value={data.varsayilanRolId ?? ''}
					onChange={(e) => void setDefault(e.target.value)}
					aria-label={t('rolesDefaultRoleAria')}
				>
					<option value="">{t('rolesOnlyPersonal')}</option>
					{data.roller
						.filter((r) => !r.sistem && !isAlumniRole(r))
						.map((r) => (
							<option key={r.id} value={r.id}>
								{r.ad}
							</option>
						))}
				</select>
			</label>

			<RolesList roller={data.roller} onEdit={(r) => setEditing(r)} onRemove={(r) => void remove(r)} />


			{deleting && (
				<DeleteRoleSheet
					role={deleting}
					hedefler={data.roller.filter((r) => !r.sistem && r.id !== deleting.id)}
					varsayilan={data.varsayilanRolId}
					onClose={() => setDeleting(null)}
					onDelete={(tasi) => deleteRole(deleting, tasi)}
				/>
			)}

			{editing && (
				<RoleEditor
					role={editing === 'new' ? null : editing}
					benimIzinlerim={data.benimIzinlerim}
					onClose={() => setEditing(null)}
					onSaved={async (msg) => {
						setEditing(null);
						notify(msg);
						await refetch();
					}}
				/>
			)}
		</div>
	);
}
