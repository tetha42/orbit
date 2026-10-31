'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { getAppMeta } from '@/configs/apps.config';
import type { AppID } from '@/types/workspace';
import { Lock, Pencil, Trash2, Users } from 'lucide-react';
import { ALUMNI_ROLE_ID, PERMISSION_DESCRIPTIONS, PERMISSION_APPS, seviyeOf } from '@/core/permissions';
import ui from '@/core/ui/ui.module.css';
import type { RoleView } from './RoleEditor';
import s from './Roles.module.css';

interface RolesListProps {
	roller: RoleView[];
	onEdit: (role: RoleView) => void;
	onRemove: (role: RoleView) => void;
}

export function RolesList({ roller, onEdit, onRemove }: RolesListProps) {
	const { t, language } = useI18n();
	return (
		<div className={s.list}>
			{roller.map((r) => {
				const apps = PERMISSION_APPS.filter((a) => seviyeOf(r.izinler, a) !== 'yok' && a !== 'settings');
				return (
					<article key={r.id} className={s.role} data-role-id={r.id}>
						<span className={s.swatch} style={{ background: r.renk }} />
						<div className={s.roleBody}>
							<div className={s.roleName}>
								{r.ad}
								{r.sistem && (
									<span className={s.pill}>
										<Lock size={11} /> {t('rolesBuiltin')}
									</span>
								)}
								{r.ikiAdimZorunlu && <span className={s.pill}>{t('twofactorRequiredBadge')}</span>}
							</div>
							{r.aciklama && <div className={ui.muted} style={{ fontSize: 12 }}>{r.aciklama}</div>}
							<div className={s.apps}>
								{r.sistem ? (
									<span className={s.app}>{t('rolesAllAppsManage')}</span>
								) : apps.length === 0 ? (
									<span className={ui.muted} style={{ fontSize: 12 }}>{t('rolesOnlyPersonal')}</span>
								) : (
									apps.map((a) => (
										<span key={a} className={`${s.app} ${seviyeOf(r.izinler, a) === 'yonet' ? s.appManage : ''}`}>
											{getAppMeta(a as AppID, language)?.shortTitle || PERMISSION_DESCRIPTIONS[a].ad}
											{seviyeOf(r.izinler, a) === 'yonet' ? ` · ${t('rolesLevelManage')}` : ''}
										</span>
									))
								)}
							</div>
						</div>
						<span className={s.count} title={t('rolesMemberCount')}>
							<Users size={13} /> {r.kullaniciSayisi}
						</span>
						{!r.sistem && (
							<div className={s.actions}>
								<button type="button" className={ui.iconBtn} onClick={() => onEdit(r)} aria-label={fill(t('rolesEditAria'), { name: r.ad })}>
									<Pencil size={14} />
								</button>
								{r.id !== ALUMNI_ROLE_ID && (
									<button type="button" className={ui.iconBtn} onClick={() => onRemove(r)} aria-label={fill(t('rolesDeleteAria'), { name: r.ad })}>
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
