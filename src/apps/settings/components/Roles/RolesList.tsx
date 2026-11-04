'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { getAppMeta } from '@/configs/apps.config';
import type { AppID } from '@/types/workspace';
import { Lock, Pencil, Trash2, Users } from 'lucide-react';
import { ALUMNI_ROLE_ID, PERMISSION_DESCRIPTIONS, PERMISSION_APPS, levelOf } from '@/core/permissions';
import ui from '@/core/ui/ui.module.css';
import type { RoleView } from './RoleEditor';
import s from './Roles.module.css';

interface RolesListProps {
	roles: RoleView[];
	onEdit: (role: RoleView) => void;
	onRemove: (role: RoleView) => void;
}

export function RolesList({ roles, onEdit, onRemove }: RolesListProps) {
	const { t, language } = useI18n();
	return (
		<div className={s.list}>
			{roles.map((r) => {
				const apps = PERMISSION_APPS.filter((a) => levelOf(r.permissions, a) !== 'none' && a !== 'settings');
				return (
					<article key={r.id} className={s.role} data-role-id={r.id}>
						<span className={s.swatch} style={{ background: r.color }} />
						<div className={s.roleBody}>
							<div className={s.roleName}>
								{r.name}
								{r.system && (
									<span className={s.pill}>
										<Lock size={11} /> {t('rolesBuiltin')}
									</span>
								)}
								{r.twoStepRequired && <span className={s.pill}>{t('twofactorRequiredBadge')}</span>}
							</div>
							{r.description && <div className={ui.muted} style={{ fontSize: 12 }}>{r.description}</div>}
							<div className={s.apps}>
								{r.system ? (
									<span className={s.app}>{t('rolesAllAppsManage')}</span>
								) : apps.length === 0 ? (
									<span className={ui.muted} style={{ fontSize: 12 }}>{t('rolesOnlyPersonal')}</span>
								) : (
									apps.map((a) => (
										<span key={a} className={`${s.app} ${levelOf(r.permissions, a) === 'manage' ? s.appManage : ''}`}>
											{getAppMeta(a as AppID, language)?.shortTitle || PERMISSION_DESCRIPTIONS[a].name}
											{levelOf(r.permissions, a) === 'manage' ? ` · ${t('rolesLevelManage')}` : ''}
										</span>
									))
								)}
							</div>
						</div>
						<span className={s.count} title={t('rolesMemberCount')}>
							<Users size={13} /> {r.userCount}
						</span>
						{!r.system && (
							<div className={s.actions}>
								<button type="button" className={ui.iconBtn} onClick={() => onEdit(r)} aria-label={fill(t('rolesEditAria'), { name: r.name })}>
									<Pencil size={14} />
								</button>
								{r.id !== ALUMNI_ROLE_ID && (
									<button type="button" className={ui.iconBtn} onClick={() => onRemove(r)} aria-label={fill(t('rolesDeleteAria'), { name: r.name })}>
										<Trash2 size={14} />
									</button>
								)}
							</div>
						)}
					</article>
				);
			})}
		</div>
	);
}
