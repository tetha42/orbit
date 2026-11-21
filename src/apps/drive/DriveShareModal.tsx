'use client';

import React, { useEffect, useState } from 'react';
import { Share2, Trash2, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { DriveSharePermission, DriveShareRecord } from '@/domains/drive/types';
import { fill } from '@/lib/text';

interface DriveShareModalProps {
	target: { id: string; name: string; kind: 'item' | 'folder' } | null;
	onClose: () => void;
}

const selectStyle: React.CSSProperties = {
	background: 'var(--surface-hover)',
	border: '1px solid var(--border-subtle)',
	borderRadius: '8px',
	padding: '6px 8px',
	color: 'var(--text-primary)',
	fontSize: '12px',
};

export function DriveShareModal({ target, onClose }: DriveShareModalProps) {
	const { t } = useI18n();
	const [targetType, setTargetType] = useState<'member' | 'role'>('member');
	const [targetId, setTargetId] = useState('');
	const [permission, setPermission] = useState<DriveSharePermission>('view');
	const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
	const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
	const [shares, setShares] = useState<DriveShareRecord[]>([]);

	useEffect(() => {
		if (!target) return;
		const load = async () => {
			try {
				const qParam = target.kind === 'item' ? `itemId=${target.id}` : `folderId=${target.id}`;
				const [shRes, mRes, rRes] = await Promise.all([
					fetch(`/api/drive/shares?${qParam}`, { cache: 'no-store' }),
					fetch('/api/members', { cache: 'no-store' }),
					fetch('/api/roles', { cache: 'no-store' }),
				]);
				if (shRes.ok) {
					const d = (await shRes.json()) as { shares?: DriveShareRecord[] };
					setShares(Array.isArray(d.shares) ? d.shares : []);
				}
				if (mRes.ok) {
					const md = (await mRes.json()) as { members?: Array<{ id: string; name?: string; email?: string }> };
					setMembers((md.members || []).map((m) => ({ id: m.id, name: m.name || m.email || m.id })));
				}
				if (rRes.ok) {
					const rd = (await rRes.json()) as { roles?: Array<{ id: string; name: string }> };
					setRoles(Array.isArray(rd.roles) ? rd.roles : []);
				}
			} catch (err) {
				console.warn('[Drive] Failed to load share options:', err);
			}
		};
		void load();
	}, [target]);

	if (!target) return null;

	const handleAddShare = async () => {
		if (!targetId) return;
		const res = await fetch('/api/drive/shares', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				itemId: target.kind === 'item' ? target.id : null,
				folderId: target.kind === 'folder' ? target.id : null,
				targetUserId: targetType === 'member' ? targetId : null,
				targetRoleId: targetType === 'role' ? targetId : null,
				permission,
			}),
		});
		if (res.ok) {
			setTargetId('');
			const qParam = target.kind === 'item' ? `itemId=${target.id}` : `folderId=${target.id}`;
			const shRes = await fetch(`/api/drive/shares?${qParam}`, { cache: 'no-store' });
			if (shRes.ok) {
				const d = (await shRes.json()) as { shares?: DriveShareRecord[] };
				setShares(Array.isArray(d.shares) ? d.shares : []);
			}
		}
	};

	const handleRevoke = async (shareId: string) => {
		const res = await fetch(`/api/drive/shares?id=${encodeURIComponent(shareId)}`, { method: 'DELETE' });
		if (res.ok) setShares((prev) => prev.filter((s) => s.id !== shareId));
	};

	const choices = targetType === 'member' ? members : roles;

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0,0,0,0.55)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 1000,
			}}
		>
			<div
				style={{
					background: 'var(--window-bg)',
					border: '1px solid var(--border-subtle)',
					borderRadius: '14px',
					padding: '18px',
					width: '420px',
					maxWidth: '92vw',
					color: 'var(--text-primary)',
					display: 'flex',
					flexDirection: 'column',
					gap: '12px',
				}}
			>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
						<Share2 size={16} color="var(--accent)" />
						<span>{fill(t('driveShareTitle'), { name: target.name })}</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
					>
						<X size={16} />
					</button>
				</div>

				<div style={{ display: 'flex', gap: '8px' }}>
					<select
						value={targetType}
						onChange={(e) => {
							setTargetType(e.target.value as 'member' | 'role');
							setTargetId('');
						}}
						style={selectStyle}
					>
						<option value="member">{t('driveShareMember')}</option>
						<option value="role">{t('driveShareRole')}</option>
					</select>
					<select
						value={targetId}
						onChange={(e) => setTargetId(e.target.value)}
						style={{ ...selectStyle, flex: 1 }}
					>
						<option value="">{t('driveShareSelectTarget')}</option>
						{choices.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</select>
				</div>

				<div style={{ display: 'flex', gap: '8px' }}>
					<select
						value={permission}
						onChange={(e) => setPermission(e.target.value as DriveSharePermission)}
						style={{ ...selectStyle, flex: 1 }}
					>
						<option value="view">{t('drivePermView')}</option>
						<option value="edit">{t('drivePermEdit')}</option>
					</select>
					<button
						type="button"
						onClick={() => void handleAddShare()}
						style={{
							background: 'var(--accent)',
							color: 'var(--text-on-accent)',
							border: 'none',
							borderRadius: '8px',
							padding: '6px 14px',
							fontWeight: 600,
							fontSize: '12px',
							cursor: 'pointer',
						}}
					>
						{t('driveShareAddBtn')}
					</button>
				</div>

				<div style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>{t('driveShareCurrentList')}</div>
				<div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
					{shares.length === 0 ? (
						<div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('driveShareEmpty')}</div>
					) : (
						shares.map((sh) => (
							<div
								key={sh.id}
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									padding: '6px 10px',
									borderRadius: '8px',
									background: 'var(--surface-hover)',
									border: '1px solid var(--border-subtle)',
									fontSize: '12px',
								}}
							>
								<span>
									{sh.targetUserName || sh.targetRoleName || sh.targetUserId || sh.targetRoleId} ·{' '}
									{sh.permission === 'edit' ? t('drivePermEdit') : t('drivePermView')}
								</span>
								<button
									type="button"
									onClick={() => void handleRevoke(sh.id)}
									title={t('driveShareRevoke')}
									style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
								>
									<Trash2 size={14} />
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
