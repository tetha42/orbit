'use client';

import { useState } from 'react';
import { useDialog } from '@/components/Common/DialogProvider';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { sendJson } from '@/core/data/http';
import type { GorevDurumu } from '@/lib/kanban';
import type { TeamTaskItem, TeamTaskComment } from '@/db/schema';
import type { TeamTask } from '../types';

interface Detail {
	task: TeamTask;
	maddeler: TeamTaskItem[];
	yorumlar: TeamTaskComment[];
	izinler: { manage: boolean; work: boolean; comment: boolean };
}

interface UseTaskDetailParams {
	url: string;
	data: Detail | null;
	setData: React.Dispatch<React.SetStateAction<Detail | null>>;
	refetch: () => Promise<void>;
	onChanged: () => Promise<void>;
	notify: (text: string, tone?: 'success' | 'error') => void;
	onClose: () => void;
	confirmOpenRef: React.MutableRefObject<boolean>;
}

export function useTaskDetail({
	url,
	data,
	setData,
	refetch,
	onChanged,
	notify,
	onClose,
	confirmOpenRef,
}: UseTaskDetailParams) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();

	const [titleDraft, setTitleDraft] = useState<string | null>(null);
	const [descDraft, setDescDraft] = useState<string | null>(null);
	const [itemDraft, setItemDraft] = useState('');
	const [commentDraft, setCommentDraft] = useState('');
	const [busy, setBusy] = useState(false);

	const ask = async (message: string) => {
		confirmOpenRef.current = true;
		try {
			return await dialog.confirm({ message, tone: 'danger' });
		} finally {
			confirmOpenRef.current = false;
		}
	};

	const after = async (res: { ok: boolean; error?: string }, success?: string) => {
		if (!res.ok) {
			notify(res.error || t('kbActionFailed'), 'error');
		} else if (success) {
			notify(success);
		}
		await Promise.all([refetch(), onChanged()]);
		return res.ok;
	};

	const patch = async (body: Record<string, unknown>) => after(await sendJson(url, 'PATCH', body));
	const action = async (body: Record<string, unknown>) => after(await sendJson(url, 'POST', body));

	const saveTitle = async () => {
		const next = titleDraft?.trim();
		setTitleDraft(null);
		if (data && next && next !== data.task.baslik) await patch({ baslik: next });
	};

	const saveDesc = async () => {
		if (descDraft === null) return;
		const next = descDraft;
		const ok = await patch({ aciklama: next });
		if (ok) setDescDraft(null);
	};

	const setStatus = async (status: GorevDurumu) => {
		if (!data) return;
		const res = await sendJson<{ xpVerildi?: boolean }>('/api/teams', 'POST', {
			action: 'updateTask',
			gorevId: data.task.id,
			status,
		});
		if (res.ok) playSystemSound();
		await after(res, res.ok && res.data?.xpVerildi ? t('kbXpEarned') : undefined);
	};

	const toggleItem = async (m: TeamTaskItem) => {
		const tamamMi = Number(m.tamamMi) !== 1;
		setData((d) =>
			d ? { ...d, maddeler: d.maddeler.map((x) => (x.id === m.id ? { ...x, tamamMi: tamamMi ? 1 : 0 } : x)) } : d
		);
		await action({ action: 'updateItem', maddeId: m.id, tamamMi });
	};

	const addItem = async (e: React.FormEvent) => {
		e.preventDefault();
		const metin = itemDraft.trim();
		if (!metin) return;
		setItemDraft('');
		await action({ action: 'addItem', metin });
	};

	const sendComment = async () => {
		const icerik = commentDraft.trim();
		if (!icerik || busy) return;
		setBusy(true);
		const ok = await action({ action: 'addComment', icerik });
		setBusy(false);
		if (ok) setCommentDraft((d) => (d.trim() === icerik ? '' : d));
	};

	const deleteComment = async (y: TeamTaskComment) => {
		if (!(await ask(t('kbDeleteCommentConfirm')))) return;
		await action({ action: 'deleteComment', yorumId: y.id });
	};

	const deleteTask = async () => {
		if (!data || !(await ask(fill(t('kbDeleteConfirm'), { title: data.task.baslik })))) return;
		const res = await sendJson('/api/teams', 'POST', { action: 'deleteTask', gorevId: data.task.id });
		if (!res.ok) {
			notify(res.error || t('kbActionFailed'), 'error');
			return;
		}
		await onChanged();
		onClose();
	};

	return {
		titleDraft,
		setTitleDraft,
		descDraft,
		setDescDraft,
		itemDraft,
		setItemDraft,
		commentDraft,
		setCommentDraft,
		busy,
		saveTitle,
		saveDesc,
		setStatus,
		toggleItem,
		addItem,
		sendComment,
		deleteComment,
		deleteTask,
		patch,
		action,
	};
}
