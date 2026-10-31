'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Download, ShieldAlert, UserX } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { errorMessage } from '@/lib/errors';
import ui from '@/core/ui/ui.module.css';

interface MemberOption {
	id: string;
	ad: string;
	soyad: string;
	email: string;
}

const TABLE_KEYS = [
	{ value: 'users', label: 'privacyTableUsers' },
	{ value: 'teams', label: 'privacyTableTeams' },
	{ value: 'teamMembers', label: 'privacyTableTeamMembers' },
	{ value: 'projects', label: 'privacyTableProjects' },
	{ value: 'events', label: 'privacyTableEvents' },
	{ value: 'decisions', label: 'privacyTableDecisions' },
	{ value: 'committeeMeetings', label: 'privacyTableCommitteeMeetings' },
] as const;

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 10px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0,0,0,0.22)',
	color: 'inherit',
	fontSize: '12px',
	boxSizing: 'border-box',
};

export function PrivacyDataPanel() {
	const { t } = useI18n();
	const dialog = useDialog();
	const [members, setMembers] = useState<MemberOption[]>([]);
	const [selected, setSelected] = useState('');
	const [confirm, setConfirm] = useState('');
	const [table, setTable] = useState('users');
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

	useEffect(() => {
		fetch('/api/members', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (Array.isArray(payload?.members)) setMembers(payload.members);
			})
			.catch(() => {});
	}, []);

	const anonymize = async () => {
		if (!selected) return;
		const confirmed = await dialog.confirm({
			title: t('privacyAnonymizeAction'),
			message: t('privacyAnonymizeConfirm'),
			tone: 'danger',
			confirmLabel: t('privacyAnonymizeAction'),
		});
		if (!confirmed) return;
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch('/api/settings/anonymize', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: selected, confirm: 'ANONYMIZE' }),
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error || t('privacyAnonymizeFailed'));
			setMembers((previous) => previous.filter((item) => item.id !== selected));
			setSelected('');
			setConfirm('');
			setMessage({ text: t('privacyAnonymized'), type: 'ok' });
		} catch (error) {
			setMessage({ text: errorMessage(error) || t('privacyAnonymizeFailed'), type: 'err' });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div data-focus-section="privacy" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
			<div>
				<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('privacyTitle')}</h2>
				<p style={{ margin: '3px 0 0', fontSize: '12.5px', opacity: 0.65 }}>{t('privacyDesc')}</p>
			</div>

			{message && (
				<div
					style={{
						fontSize: '12px',
						padding: '9px 11px',
						borderRadius: '8px',
						background: message.type === 'ok' ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
						color: message.type === 'ok' ? '#30d158' : '#ff453a',
					}}
				>
					{message.text}
				</div>
			)}

			<div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--window-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '13px' }}>
					<Download size={15} /> {t('privacyExport')}
				</div>
				<p style={{ margin: 0, fontSize: '11.5px', opacity: 0.6 }}>{t('privacyExportDesc')}</p>
				<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
					<a className={ui.primaryBtn} href="/api/settings/export" download>
						<Download size={13} /> {t('privacyDownloadJson')}
					</a>
					<select style={{ ...inputStyle, width: 'auto' }} value={table} onChange={(e) => setTable(e.target.value)}>
						{TABLE_KEYS.map((item) => (
							<option key={item.value} value={item.value}>{t(item.label)}</option>
						))}
					</select>
					<a className={ui.btn} href={`/api/settings/export?table=${encodeURIComponent(table)}`} download>
						{t('privacyTableCsv')}
					</a>
				</div>
			</div>

			<div style={{ padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,69,58,0.35)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 700, fontSize: '13px', color: '#ff453a' }}>
					<ShieldAlert size={15} /> {t('privacyAnonymize')}
				</div>
				<p style={{ margin: 0, fontSize: '11.5px', opacity: 0.7 }}>{t('privacyAnonymizeDesc')}</p>
				<div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', opacity: 0.65 }}>
					<AlertTriangle size={13} /> {t('privacyWarning')}
				</div>
				<select style={inputStyle} value={selected} onChange={(e) => setSelected(e.target.value)}>
					<option value="">{t('privacySelectMember')}</option>
					{members.map((member) => (
						<option key={member.id} value={member.id}>
							{member.ad} {member.soyad} · {member.email}
						</option>
					))}
				</select>
				<input
					style={inputStyle}
					value={confirm}
					onChange={(e) => setConfirm(e.target.value)}
					placeholder={t('privacyConfirmHint')}
				/>
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<button
						type="button"
						className={ui.btn}
						style={{ color: '#ff453a', borderColor: 'rgba(255,69,58,0.4)' }}
						disabled={busy || !selected || confirm !== 'ANONYMIZE'}
						onClick={() => void anonymize()}
					>
						<UserX size={13} /> {t('privacyAnonymizeAction')}
					</button>
				</div>
			</div>
		</div>
	);
}
