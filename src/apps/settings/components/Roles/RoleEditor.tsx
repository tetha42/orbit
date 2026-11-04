'use client';

import React, { useMemo, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { manifestOf } from '@/apps';
import { fill } from '@/lib/text';
import { AlertTriangle, ShieldCheck, Lock } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { sendJson } from '@/core/data/http';
import { invalidateResource } from '@/core/data/useJsonResource';
import ui from '@/core/ui/ui.module.css';
import {
	ROLE_COLORS,
	PERMISSION_DESCRIPTIONS,
	PERMISSION_APPS,
	extraPermissions,
	hasManagementPermission,
	levelOf,
	type Permissions,
	type Level,
	type PermissionApp,
} from '@/core/permissions';
import s from './Roles.module.css';

export interface RoleView {
	id: string;
	name: string;
	color: string;
	description: string;
	system: boolean;
	twoStepRequired: boolean;
	permissions: Permissions;
	userCount: number;
}

interface RoleEditorProps {
	role: RoleView | null;
	myPermissions: Permissions;
	onClose: () => void;
	onSaved: (msg: string) => void;
}


function englishAppTitle(app: PermissionApp): string {
	const manifest = manifestOf(app);
	return manifest && 'en' in manifest ? manifest.en.shortTitle : PERMISSION_DESCRIPTIONS[app].name;
}

export function RoleEditor({ role, myPermissions, onClose, onSaved }: RoleEditorProps) {
	const { t, language } = useI18n();
	const isEn = language === 'en';
	const LEVEL_NAME: Record<Level, string> = { none: t('rolesLevelNone'), use: t('rolesLevelUse'), manage: t('rolesLevelManage') };
	const [name, setName] = useState(role?.name ?? '');
	const [color, setColor] = useState(role?.color ?? ROLE_COLORS[0]);
	const [description, setDescription] = useState(role?.description ?? '');
	const [permissions, setPermissions] = useState<Permissions>(role?.permissions ?? { news: 'use', settings: 'use' });
	const isManagement = hasManagementPermission(permissions);
	const [twoStep, setTwoStep] = useState<boolean | null>(role ? role.twoStepRequired : null);
	const twoStepActive = isManagement ? true : (twoStep ?? false);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const excess = useMemo(() => extraPermissions(permissions, myPermissions), [permissions, myPermissions]);

	const set = (a: PermissionApp, v: Level) => setPermissions((cur) => ({ ...cur, [a]: v }));

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setBusy(true);
		const body = { name: name.trim(), color, description: description.trim(), permissions, twoStepRequired: twoStepActive };
		const res = role ? await sendJson('/api/roles', 'PATCH', { id: role.id, ...body }) : await sendJson('/api/roles', 'POST', body);
		setBusy(false);
		if (!res.ok) return setError(res.error || t('rolesSaveFailed'));
		invalidateResource('/api/roles');
		onSaved(role ? t('rolesSaved') : t('rolesCreated'));
	};

	return (
		<Sheet
			title={role ? fill(t('rolesEditTitle'), { name: role.name }) : t('rolesNewTitle')}
			label={role ? fill(t('rolesEditTitle'), { name: role.name }) : t('rolesNewTitle')}
			icon={<ShieldCheck size={18} color={color} />}
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
					<input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required autoFocus placeholder={t('rolesNamePh')} />
				</label>
				<div className={ui.field}>
					<span className={ui.fieldLabel}>{t('rolesColorLabel')}</span>
					<div className={s.swatches} role="radiogroup" aria-label={t('rolesColorLabel')}>
						{ROLE_COLORS.map((c) => (
							<button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} className={`${s.swatchBtn} ${color === c ? s.swatchActive : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
						))}
						<input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t('rolesCustomColor')} className={s.colorInput} />
					</div>
				</div>
			</div>
			<label className={ui.field}>
				<span className={ui.fieldLabel}>{t('rolesDescLabel')}</span>
				<input className={ui.input} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder={t('rolesDescPh')} />
			</label>

			<div className={s.matrix} role="table" aria-label={t('rolesAppPermissions')}>
				{PERMISSION_APPS.map((a) => {
					const meta = PERMISSION_DESCRIPTIONS[a];
					const v = levelOf(permissions, a);
					const options: Level[] = a === 'settings' ? ['use', 'manage'] : ['none', 'use', 'manage'];
					return (
						<div key={a} className={s.matrixRow} role="row" data-app={a}>
							<div className={s.matrixApp} role="cell">
								<strong>{isEn ? englishAppTitle(a) : meta.name}</strong>
								<span className={ui.muted}>
									{v === 'none'
										? t('rolesAppHidden')
										: isEn
											? fill(t(v === 'manage' ? 'rolesPermManageGeneric' : 'rolesPermUseGeneric'), {
													app: englishAppTitle(a),
												})
											: meta[v === 'manage' ? 'manage' : 'use']}
								</span>
								{meta.warning && v !== 'none' && (
									<span className={s.warn}>
										<AlertTriangle size={12} /> {isEn ? t('rolesPermWarningGeneric') : meta.warning}
									</span>
								)}
							</div>
							<div className={ui.segmented} role="radiogroup" aria-label={`${meta.name} yetkisi`}>
								{options.map((o) => (
									<button key={o} type="button" role="radio" aria-checked={v === o} className={`${ui.segment} ${v === o ? ui.segmentActive : ''}`} onClick={() => set(a, o)}>
										{LEVEL_NAME[o]}
									</button>
								))}
							</div>
						</div>
					);
				})}
			</div>

			<label className={s.check} style={isManagement ? { cursor: 'not-allowed', opacity: 0.9 } : undefined}>
				<input
					type="checkbox"
					checked={twoStepActive}
					disabled={isManagement}
					onChange={(e) => setTwoStep(e.target.checked)}
				/>
				{t('roles2faRequired')}
				{isManagement ? (
					<span
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							marginLeft: '8px',
							fontSize: '11px',
							padding: '1px 6px',
							borderRadius: '4px',
							background: 'var(--fill-medium, rgba(255,255,255,0.08))',
							color: 'var(--color-warning, #ff9f0a)',
						}}
						title={t('roles2faAdminAutoNotice')}
					>
						<Lock size={11} />
						{t('roles2faAdminAutoNotice')}
					</span>
				) : (
					twoStep === null && <span className={ui.muted}> {t('roles2faAdminAutoNotice')}</span>
				)}
			</label>
			<div className={ui.hint} style={{ marginTop: -4 }}>{t('roles2faHint')}</div>
			{excess.length > 0 && (
				<div className={ui.error}>
					Kendinizde olmayan yetkileri veremezsiniz: {excess.map((a) => PERMISSION_DESCRIPTIONS[a].name).join(', ')}
				</div>
			)}
			{error && <div className={ui.error}>{error}</div>}
		</Sheet>
	);
}
