'use client';

import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { fill, foldSearchText } from '@/lib/text';
import { DecisionList } from './DecisionList';
import { DecisionDetail } from './DecisionDetail';
import { DecisionCreateForm, type NewDecisionPayload } from './DecisionCreateForm';
import { DecisionEditSheet, type DecisionEditPayload } from './DecisionEditSheet';
import { documentRef, VERIFICATION_PREFIX } from './documentMeta';
import type { Decision } from './types';

interface DecisionDocumentsProps {
	decisions: Decision[];
	canManage: boolean;
	isAdmin: boolean;
	formatDate: (value: number) => string;
	onChanged: () => Promise<unknown>;
}

const escapeHtml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The document archive tab: search, read, write, edit, lock, unlock and delete. */
export function DecisionDocuments({ decisions, canManage, isAdmin, formatDate, onChanged }: DecisionDocumentsProps) {
	const { t } = useI18n();
	const dialog = useDialog();
	const [query, setQuery] = useState('');
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const q = foldSearchText(query.trim());
		if (!q) return decisions;
		return decisions.filter((d) => [d.title, d.content, d.agenda].some((v) => foldSearchText(v).includes(q)));
	}, [decisions, query]);

	const selected = decisions.find((d) => d.id === selectedId) ?? null;
	const editing = editingId ? decisions.find((d) => d.id === editingId) ?? null : null;

	const call = async (url: string, method: string, body?: unknown) => {
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch(url, {
				method,
				headers: body ? { 'Content-Type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined,
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) throw new Error(data?.error || t('gvActionFailed'));
			return data ?? {};
		} catch (error) {
			setMessage(error instanceof Error ? error.message : t('gvActionFailed'));
			return null;
		} finally {
			setBusy(false);
		}
	};

	const create = async (payload: NewDecisionPayload) => {
		const data = await call('/api/decisions', 'POST', payload);
		if (!data) return false;
		await onChanged();
		setCreating(false);
		if (typeof data.id === 'string') setSelectedId(data.id);
		return true;
	};

	const saveEdit = async (payload: DecisionEditPayload) => {
		if (!editing) return false;
		const data = await call('/api/decisions', 'PATCH', { id: editing.id, ...payload });
		if (!data) return false;
		await onChanged();
		return true;
	};

	const lock = async () => {
		if (!selected) return;
		const no = documentRef(selected.referenceNumber);
		const ok = await dialog.confirm({
			message: fill(t('decisionsLockConfirm'), { no }),
			tone: 'warning',
			confirmLabel: t('decisionsLockBtn'),
		});
		if (!ok) return;
		if (await call('/api/decisions', 'POST', { action: 'lock', id: selected.id })) await onChanged();
	};

	const unlock = async () => {
		if (!selected) return;
		const no = documentRef(selected.referenceNumber);
		const ok = await dialog.confirm({ message: fill(t('decisionsUnlockConfirm'), { no }), tone: 'warning', confirmLabel: t('decisionsUnlockBtn') });
		if (!ok) return;
		if (await call('/api/decisions', 'POST', { action: 'unlock', id: selected.id })) await onChanged();
	};

	const remove = async () => {
		if (!selected) return;
		const ok = await dialog.confirm({
			message: t('decisionsDeleteConfirm'),
			tone: 'danger',
			confirmLabel: t('delete'),
		});
		if (!ok) return;
		if (await call(`/api/decisions?id=${encodeURIComponent(selected.id)}`, 'DELETE')) {
			setSelectedId(null);
			await onChanged();
		}
	};

	const copy = async () => {
		if (!selected) return;
		try {
			await navigator.clipboard.writeText(`${selected.title}\n${selected.agenda}\n${selected.content}`);
			setMessage(t('decisionsCopyText'));
		} catch {
			setMessage(t('gvActionFailed'));
		}
	};

	const printable = (document: Decision, label: string) => {
		const win = window.open('', '_blank', 'width=820,height=900');
		if (!win) return;
		const no = documentRef(document.referenceNumber);
		win.document.write(`<!doctype html><html><head><title>${escapeHtml(label)} ${escapeHtml(no)}</title>
			<style>body{font-family:Georgia,serif;max-width:760px;margin:32px auto;line-height:1.6;color:#111}
			h1{font-size:18px;text-align:center;letter-spacing:.04em}small{color:#555}
			.meta{display:flex;justify-content:space-between;font-size:12px;margin:18px 0;border-bottom:1px solid #bbb;padding-bottom:8px}
			.label{font-weight:700;font-size:11px;letter-spacing:.06em;color:#444;margin-top:16px}
			.body{white-space:pre-wrap;font-size:14px}.verify{margin-top:28px;font-size:10.5px;color:#444;border-top:1px dashed #999;padding-top:8px}</style>
			</head><body><h1>${escapeHtml(t('decisionsOrgName'))}<br/>${escapeHtml(label)}</h1>
			<div class="meta"><span>${escapeHtml(t('decisionsDocNo'))} ${escapeHtml(no)}</span><span>${escapeHtml(formatDate(document.date))}</span></div>
			<div class="label">${escapeHtml(t('decisionsSubject'))}</div><div class="body">${escapeHtml(document.title)}</div>
			<div class="label">${escapeHtml(t('decisionsAgendaHeader'))}</div><div class="body">${escapeHtml(document.agenda ?? '')}</div>
			<div class="label">${escapeHtml(t('decisionsTextLabel'))}</div><div class="body">${escapeHtml(document.content)}</div>
			<div class="verify">${escapeHtml(t('decisionsVerifyCode'))} ${VERIFICATION_PREFIX}${document.referenceNumber}
			${document.summary ? ` · ${escapeHtml(t('decisionsSummaryLabel'))} ${escapeHtml(document.summary)}` : ''}</div>
			</body></html>`);
		win.document.close();
		win.focus();
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: 1 }}>
			{message && (
				<div
					role="status"
					style={{ fontSize: 12, padding: '7px 10px', borderRadius: 7, background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
				>
					{message}
				</div>
			)}
			<div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 0.85fr) minmax(320px, 1.4fr)', gap: 14, minHeight: 0, flex: 1 }}>
				<DecisionList
					decisions={filtered}
					selectedId={selectedId}
					query={query}
					canManage={canManage}
					onQueryChange={setQuery}
					onSelect={(id) => {
						setSelectedId(id);
						setCreating(false);
					}}
					onNew={() => {
						setCreating(true);
						setSelectedId(null);
					}}
					formatDate={formatDate}
				/>

				<div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
					{creating ? (
						<DecisionCreateForm busy={busy} onCancel={() => setCreating(false)} onCreate={create} />
					) : selected ? (
						<DecisionDetail
							decision={selected}
							canManage={canManage}
							isAdmin={isAdmin}
							formatDate={formatDate}
							onEdit={() => setEditingId(selected.id)}
							onLock={() => void lock()}
							onUnlock={() => void unlock()}
							onDelete={() => void remove()}
							onCopy={() => void copy()}
							onPrint={() => printable(selected, t('decisionsAppTitle'))}
							onPetition={() => printable(selected, t('decisionsGetPetition'))}
						/>
					) : (
						<div
							style={{
								flex: 1,
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 8,
								opacity: 0.55,
								fontSize: 12.5,
								border: '1px dashed var(--window-border)',
								borderRadius: 10,
								padding: 20,
								textAlign: 'center',
							}}
						>
							<FileText size={26} />
							{t('decisionsNoSelection')}
						</div>
					)}
				</div>
			</div>

			{editing && (
				<DecisionEditSheet decision={editing} busy={busy} onClose={() => setEditingId(null)} onSave={saveEdit} />
			)}
		</div>
	);
}
