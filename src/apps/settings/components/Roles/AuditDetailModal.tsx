'use client';

import React from 'react';
import { History } from 'lucide-react';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { formatDateTime } from '@/core/data/format';
import { isPermissionApp, PERMISSION_DESCRIPTIONS } from '@/core/permissions';
import { getAppMeta } from '@/configs/apps.config';
import type { AppID } from '@/types/workspace';
import { diffRows, formatAuditAction, type AuditRecord } from '@/lib/audit';
import s from './Roles.module.css';

interface AuditDetailModalProps {
	detay: AuditRecord | null;
	onClose: () => void;
}

export function AuditDetailModal({ detay, onClose }: AuditDetailModalProps) {
	const { t, language } = useI18n();

	if (!detay) return null;

	const diffs = diffRows(detay.onceki, detay.sonraki);

	const formatAuditValue = (alan: string, val: unknown): string => {
		if (val === null || val === undefined) return '—';
		if (typeof val === 'boolean') {
			return val ? t('auditYes') : t('auditNo');
		}
		if (alan === 'roleId' || alan === 'tasinanRolId') {
			if (val === 'rol_admin') return t('auditRoleAdmin', 'Yönetici (Admin)');
			if (val === 'rol_yonetim_kurulu') return t('auditRoleBoard', 'Management Board');
			if (val === 'rol_uye') return t('auditRoleMember', 'Member');
			if (val === 'rol_mezun') return t('auditRoleAlumni', 'Alumni');
		}
		if (typeof val === 'string') {
			if (val === 'yok' || val === 'kullan' || val === 'yonet' || val === 'aktif' || val === 'mezun' || val === 'beklemede' || val === 'reddedildi') {
				return t(`auditValue_${val}`, val);
			}
		}
		return String(val);
	};

	const actionTitle = formatAuditAction(detay.islem, t);

	return (
		<Sheet
			title={actionTitle}
			label={actionTitle}
			icon={<History size={18} />}
			onClose={onClose}
			maxWidth={640}
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
					gap: '10px 18px',
					padding: '14px 16px',
					borderRadius: '12px',
					background: 'var(--fill-softer, rgba(255, 255, 255, 0.04))',
					border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
					fontSize: '12.5px',
				}}
			>
				<div>
					<span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', marginBottom: '2px' }}>
						{t('auditYapan')}
					</span>
					<strong style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
						{detay.yapanAd || detay.yapanId || '—'}
					</strong>
				</div>
				<div>
					<span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', marginBottom: '2px' }}>
						{t('auditHedef')}
					</span>
					<strong style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
						{detay.hedefAd || detay.hedefId || '—'}
					</strong>
				</div>
				<div>
					<span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', marginBottom: '2px' }}>
						{t('auditZaman')}
					</span>
					<span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
						{formatDateTime(detay.zaman, language === 'en' ? 'en-GB' : 'tr-TR')}
					</span>
				</div>
				<div>
					<span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', marginBottom: '2px' }}>
						{t('auditIp')}
					</span>
					<code style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
						{detay.ip || '—'}
					</code>
				</div>
			</div>

			{diffs.length === 0 ? (
				<div style={{ opacity: 0.6, fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
					{t('auditFarkYok')}
				</div>
			) : (
				<div className={s.auditDiff}>
					<div className={`${s.auditDiffRow} ${s.auditDiffHead}`}>
						<div>{t('auditAlan')}</div>
						<div>{t('auditOnceki')}</div>
						<div>{t('auditSonraki')}</div>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column' }}>
						{diffs.map((d) => {
							const appKey = d.alan.startsWith('izinler.') ? d.alan.slice('izinler.'.length) : d.alan;
							const appMeta = isPermissionApp(appKey) ? getAppMeta(appKey as AppID, language) : null;
							const label = isPermissionApp(appKey)
								? (appMeta?.shortTitle || appMeta?.title || PERMISSION_DESCRIPTIONS[appKey]?.ad || appKey)
								: t(`auditField_${d.alan}`, d.alan);
							return (
								<div key={d.alan} className={s.auditDiffRow}>
									<div style={{ fontWeight: 650, color: 'var(--text-primary)' }}>
										{label}
									</div>
									<div>
										<span
											className={s.auditOld}
											style={{
												textDecoration: d.onceki !== null && d.onceki !== undefined ? 'line-through' : 'none',
											}}
										>
											{formatAuditValue(d.alan, d.onceki)}
										</span>
									</div>
									<div>
										<span className={s.auditNew}>
											{formatAuditValue(d.alan, d.sonraki)}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</Sheet>
	);
}
