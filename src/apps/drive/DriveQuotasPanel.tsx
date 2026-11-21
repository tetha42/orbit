'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, RotateCcw, Save } from 'lucide-react';
import { formatBytes } from '@/core/data/format';
import { useI18n } from '@/core/i18n';
import type { MemberStorageOverviewRow, StorageQuotaScope } from '@/domains/drive/types';
import s from './Drive.module.css';

const MB = 1024 * 1024;
const inputStyle: React.CSSProperties = {
	width: '90px', padding: '4px 8px', borderRadius: '6px',
	border: '1px solid var(--border-subtle)', background: 'var(--window-bg)',
	color: 'var(--text-primary)', fontSize: '12px',
};
const saveBtnStyle: React.CSSProperties = {
	background: 'var(--accent)', color: 'var(--text-on-accent)', border: 'none',
	borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer',
};
const resetBtnStyle: React.CSSProperties = {
	background: 'transparent', border: '1px solid var(--border-subtle)',
	borderRadius: '6px', padding: '4px 6px', color: 'var(--text-secondary)', cursor: 'pointer',
};

export function DriveQuotasPanel() {
	const { t } = useI18n();
	const [globalQuotaBytes, setGlobalQuotaBytes] = useState(512 * MB);
	const [orgUsedBytes, setOrgUsedBytes] = useState(0);
	const [roleQuotas, setRoleQuotas] = useState<
		Array<{ roleId: string; roleName: string; quotaBytes: number | null }>
	>([]);
	const [members, setMembers] = useState<MemberStorageOverviewRow[]>([]);
	const [search, setSearch] = useState('');
	const [globalInputMb, setGlobalInputMb] = useState('512');
	const [roleInputsMb, setRoleInputsMb] = useState<Record<string, string>>({});
	const [userInputsMb, setUserInputsMb] = useState<Record<string, string>>({});
	const [statusMsg, setStatusMsg] = useState<string | null>(null);

	const loadOverview = useCallback(async () => {
		try {
			const res = await fetch('/api/drive/quotas', { cache: 'no-store' });
			if (!res.ok) return;
			const data = (await res.json()) as {
				globalQuotaBytes: number;
				organizationUsedBytes: number;
				roleQuotas: Array<{ roleId: string; roleName: string; quotaBytes: number | null }>;
				members: MemberStorageOverviewRow[];
			};
			setGlobalQuotaBytes(data.globalQuotaBytes);
			setOrgUsedBytes(data.organizationUsedBytes);
			setRoleQuotas(data.roleQuotas || []);
			setMembers(data.members || []);
			setGlobalInputMb(
				data.globalQuotaBytes === -1 ? '-1' : String(Math.round(data.globalQuotaBytes / MB))
			);
			const rMap: Record<string, string> = {};
			for (const r of data.roleQuotas || []) {
				if (r.quotaBytes !== null) {
					rMap[r.roleId] = r.quotaBytes === -1 ? '-1' : String(Math.round(r.quotaBytes / MB));
				}
			}
			setRoleInputsMb(rMap);
			const uMap: Record<string, string> = {};
			for (const m of data.members || []) {
				if (m.customQuotaBytes !== null) {
					uMap[m.userId] =
						m.customQuotaBytes === -1 ? '-1' : String(Math.round(m.customQuotaBytes / MB));
				}
			}
			setUserInputsMb(uMap);
		} catch (err) {
			console.warn('[Drive] Failed to load quotas:', err);
		}
	}, []);

	useEffect(() => {
		void loadOverview();
	}, [loadOverview]);

	const saveQuota = async (scopeType: StorageQuotaScope, scopeId: string, mbValue: string) => {
		const num = Number(mbValue);
		if (!Number.isFinite(num) || (num < 0 && num !== -1)) {
			setStatusMsg(t('driveQuotaInvalid'));
			return;
		}
		const quotaBytes = num === -1 ? -1 : Math.round(num * MB);
		const res = await fetch('/api/drive/quotas', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ scopeType, scopeId, quotaBytes }),
		});
		if (res.ok) {
			setStatusMsg(t('driveQuotaSaved'));
			await loadOverview();
		}
	};

	const clearOverride = async (scopeType: StorageQuotaScope, scopeId: string) => {
		const qs = `scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`;
		const res = await fetch(`/api/drive/quotas?${qs}`, { method: 'DELETE' });
		if (res.ok) {
			setStatusMsg(t('driveQuotaCleared'));
			await loadOverview();
		}
	};

	const filteredMembers = members.filter((m) => {
		const q = search.trim().toLowerCase();
		return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
	});

	return (
		<div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px' }}>
					<HardDrive size={18} color="var(--accent)" />
					<span>{t('driveQuotaManagerTitle')}</span>
				</div>
				<div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
					{t('driveOrgTotalUsed')}: <strong>{formatBytes(orgUsedBytes)}</strong>
				</div>
			</div>

			{statusMsg && (
				<div style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '12px' }}>
					{statusMsg}
				</div>
			)}

			<div className={s.rowCard}>
				<div>
					<div style={{ fontSize: '13px', fontWeight: 600 }}>
						{t('driveGlobalQuotaLabel')} (MB, -1 = {t('driveQuotaUnlimited')})
					</div>
					<div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
						{globalQuotaBytes === -1 ? t('driveQuotaUnlimited') : formatBytes(globalQuotaBytes)}
					</div>
				</div>
				<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
					<input type="number" value={globalInputMb} onChange={(e) => setGlobalInputMb(e.target.value)} style={inputStyle} />
					<button type="button" onClick={() => void saveQuota('global', '', globalInputMb)} style={{ ...saveBtnStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
						<Save size={12} /> {t('driveSaveQuota')}
					</button>
				</div>
			</div>

			<div>
				<div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>{t('driveRoleQuotasTitle')}</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
					{roleQuotas.map((rq) => (
						<div key={rq.roleId} className={s.quotaCard}>
							<div style={{ fontSize: '12px', fontWeight: 600 }}>{rq.roleName}</div>
							<div style={{ display: 'flex', gap: '6px' }}>
								<input
									type="number"
									placeholder={t('driveMbUnlimitedPh')}
									value={roleInputsMb[rq.roleId] ?? ''}
									onChange={(e) => setRoleInputsMb((p) => ({ ...p, [rq.roleId]: e.target.value }))}
									style={{ ...inputStyle, flex: 1 }}
								/>
								<button type="button" onClick={() => void saveQuota('role', rq.roleId, roleInputsMb[rq.roleId] || '0')} style={saveBtnStyle}>
									{t('driveSaveQuota')}
								</button>
								{rq.quotaBytes !== null && (
									<button type="button" onClick={() => void clearOverride('role', rq.roleId)} title={t('driveClearOverride')} style={resetBtnStyle}>
										<RotateCcw size={12} />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			<div>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
					<span style={{ fontSize: '13px', fontWeight: 700 }}>{t('driveMemberQuotasTitle')}</span>
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t('driveMemberSearch')}
						style={{ ...inputStyle, width: '220px', background: 'var(--surface-hover)' }}
					/>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
					{filteredMembers.map((m) => {
						const effLabel = m.effectiveQuotaBytes === -1 ? t('driveQuotaUnlimited') : formatBytes(m.effectiveQuotaBytes);
						return (
							<div key={m.userId} className={s.rowCard}>
								<div style={{ minWidth: '180px' }}>
									<div style={{ fontSize: '12px', fontWeight: 600 }}>
										{m.name} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({m.roleName})</span>
									</div>
									<div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
										{formatBytes(m.usedBytes)} / {effLabel} · D:{formatBytes(m.byApp.drive)} N:{formatBytes(m.byApp.notes)} C:{formatBytes(m.byApp.chat)}
									</div>
								</div>
								<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
									<input
										type="number"
										placeholder="MB (-1)"
										value={userInputsMb[m.userId] ?? ''}
										onChange={(e) => setUserInputsMb((p) => ({ ...p, [m.userId]: e.target.value }))}
										style={inputStyle}
									/>
									<button type="button" onClick={() => void saveQuota('user', m.userId, userInputsMb[m.userId] || '0')} style={saveBtnStyle}>
										{t('driveSaveQuota')}
									</button>
									{m.customQuotaBytes !== null && (
										<button type="button" onClick={() => void clearOverride('user', m.userId)} title={t('driveClearOverride')} style={resetBtnStyle}>
											<RotateCcw size={12} />
										</button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
