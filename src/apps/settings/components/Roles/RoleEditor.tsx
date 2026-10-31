'use client';

import React, { useMemo, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { manifestOf } from '@/apps';
import { fill } from '@/lib/text';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { sendJson } from '@/core/data/http';
import ui from '@/core/ui/ui.module.css';
import {
	ROLE_COLORS,
	PERMISSION_DESCRIPTIONS,
	PERMISSION_APPS,
	extraPermissions,
	hasManagementPermission,
	seviyeOf,
	type Permissions,
	type Seviye,
	type PermissionApp,
} from '@/core/permissions';
import s from './Roles.module.css';

export interface RoleView {
	id: string;
	ad: string;
	renk: string;
	aciklama: string;
	sistem: boolean;
	ikiAdimZorunlu: boolean;
	izinler: Permissions;
	kullaniciSayisi: number;
}

interface RoleEditorProps {
	role: RoleView | null;
	benimIzinlerim: Permissions;
	onClose: () => void;
	onSaved: (msg: string) => void;
}


function englishAppTitle(app: PermissionApp): string {
	const manifest = manifestOf(app);
	return manifest && 'en' in manifest ? manifest.en.shortTitle : PERMISSION_DESCRIPTIONS[app].ad;
}

export function RoleEditor({ role, benimIzinlerim, onClose, onSaved }: RoleEditorProps) {
	const { t, language } = useI18n();
	const isEn = language === 'en';
	const SEVIYE_ADI: Record<Seviye, string> = { yok: t('rolesLevelNone'), kullan: t('rolesLevelUse'), yonet: t('rolesLevelManage') };
	const [ad, setAd] = useState(role?.ad ?? '');
	const [renk, setRenk] = useState(role?.renk ?? ROLE_COLORS[0]);
	const [aciklama, setAciklama] = useState(role?.aciklama ?? '');
	const [izinler, setIzinler] = useState<Permissions>(role?.izinler ?? { news: 'kullan', settings: 'kullan' });
	const [ikiAdim, setIkiAdim] = useState<boolean | null>(role ? role.ikiAdimZorunlu : null);
	const ikiAdimEtkin = ikiAdim ?? hasManagementPermission(izinler);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const excess = useMemo(() => extraPermissions(izinler, benimIzinlerim), [izinler, benimIzinlerim]);

	const set = (a: PermissionApp, v: Seviye) => setIzinler((cur) => ({ ...cur, [a]: v }));

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setBusy(true);
		const body = { ad: ad.trim(), renk, aciklama: aciklama.trim(), izinler, ikiAdimZorunlu: ikiAdimEtkin };
		const res = role ? await sendJson('/api/roles', 'PATCH', { id: role.id, ...body }) : await sendJson('/api/roles', 'POST', body);
		setBusy(false);
		if (!res.ok) return setError(res.error || t('rolesSaveFailed'));
		onSaved(role ? t('rolesSaved') : t('rolesCreated'));
	};

	return (
		<Sheet
			title={role ? fill(t('rolesEditTitle'), { name: role.ad }) : t('rolesNewTitle')}
			label={role ? fill(t('rolesEditTitle'), { name: role.ad }) : t('rolesNewTitle')}
			icon={<ShieldCheck size={18} color={renk} />}
			onClose={onClose}
			onSubmit={submit}
			maxWidth={740}
			wide
			bodyStyle={{ overflowY: 'auto', padding: '20px' }}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('cancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy || excess.length > 0}>
						{busy ? t('saving') : t('save')}
					</button>
				</>
			}
		>
			<div className={s.formTop}>
				<label className={ui.field} style={{ flex: 1 }}>
					<span className={ui.fieldLabel}>{t('rolesNameLabel')}</span>
					<input className={ui.input} value={ad} onChange={(e) => setAd(e.target.value)} minLength={2} maxLength={40} required autoFocus placeholder={t('rolesNamePh')} />
				</label>
				<div className={ui.field}>
					<span className={ui.fieldLabel}>{t('rolesColorLabel')}</span>
					<div className={s.swatches} role="radiogroup" aria-label={t('rolesColorLabel')}>
						{ROLE_COLORS.map((c) => (
							<button key={c} type="button" role="radio" aria-checked={renk === c} aria-label={c} className={`${s.swatchBtn} ${renk === c ? s.swatchActive : ''}`} style={{ background: c }} onClick={() => setRenk(c)} />
						))}
						<input type="color" value={renk} onChange={(e) => setRenk(e.target.value)} aria-label={t('rolesCustomColor')} className={s.colorInput} />
					</div>
				</div>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('rolesDescLabel')}</span>
				<input className={ui.input} value={aciklama} maxLength={200} onChange={(e) => setAciklama(e.target.value)} placeholder={t('rolesDescPh')} />
			</label>

			<div className={s.matrix} role="table" aria-label={t('rolesAppPermissions')}>
				{PERMISSION_APPS.map((a) => {
					const meta = PERMISSION_DESCRIPTIONS[a];
					const v = seviyeOf(izinler, a);
					const options: Seviye[] = a === 'settings' ? ['kullan', 'yonet'] : ['yok', 'kullan', 'yonet'];
					return (
						<div key={a} className={s.matrixRow} role="row" data-app={a}>
							<div className={s.matrixApp} role="cell">
								<strong>{isEn ? englishAppTitle(a) : meta.ad}</strong>
								<span className={ui.muted}>
									{v === 'yok'
										? t('rolesAppHidden')
										: isEn
											? fill(t(v === 'yonet' ? 'rolesPermManageGeneric' : 'rolesPermUseGeneric'), {
													app: englishAppTitle(a),
												})
											: meta[v]}
								</span>
								{meta.uyari && v !== 'yok' && (
									<span className={s.warn}>
										<AlertTriangle size={12} /> {isEn ? t('rolesPermWarningGeneric') : meta.uyari}
									</span>
								)}
							</div>
							<div className={ui.segmented} role="radiogroup" aria-label={`${meta.ad} yetkisi`}>
								{options.map((o) => (
									<button key={o} type="button" role="radio" aria-checked={v === o} className={`${ui.segment} ${v === o ? ui.segmentActive : ''}`} onClick={() => set(a, o)}>
										{SEVIYE_ADI[o]}
									</button>
								))}
							</div>
						</div>
					);
				})}
			</div>

			<label className={s.check}>
				<input type="checkbox" checked={ikiAdimEtkin} onChange={(e) => setIkiAdim(e.target.checked)} />
				{t('roles2faRequired')}
				{ikiAdim === null && hasManagementPermission(izinler) && <span className={ui.muted}> {t('roles2faAdminAutoNotice')}</span>}
			</label>
			<div className={ui.hint} style={{ marginTop: -4 }}>{t('roles2faHint')}</div>
			{excess.length > 0 && (
				<div className={ui.error}>
					Kendinizde olmayan yetkileri veremezsiniz: {excess.map((a) => PERMISSION_DESCRIPTIONS[a].ad).join(', ')}
				</div>
			)}
			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
