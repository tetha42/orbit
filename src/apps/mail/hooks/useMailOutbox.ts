'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import type { OutboxItem } from '../components/MailOutboxModal';

export function useMailOutbox(isAdmin: boolean) {
	const { t } = useI18n();
	const dialog = useDialog();
	const [outbox, setOutbox] = useState<OutboxItem[]>([]);
	const [outboxOpen, setOutboxOpen] = useState(false);
	const [outboxBusyId, setOutboxBusyId] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const loadOutbox = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			const res = await fetch('/api/mail/outbox', {
				cache: 'no-store',
				signal: controller.signal,
			});
			const data = res.ok ? await res.json() : null;
			if (!controller.signal.aborted) {
				setOutbox(Array.isArray(data?.items) ? data.items : []);
			}
		} catch (err) {
			if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
				return;
			}
			// Mailbox can still be used when the outbox endpoint is unavailable.
		} finally {
			if (abortRef.current === controller) {
				abortRef.current = null;
			}
		}
	}, []);

	useEffect(() => {
		if (!isAdmin) return;
		if (typeof document === 'undefined' || !document.hidden) {
			void loadOutbox();
		}
		const timer = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			void loadOutbox();
		}, 60_000);
		const onVisibility = () => {
			if (typeof document !== 'undefined' && !document.hidden) {
				void loadOutbox();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisibility);
			abortRef.current?.abort();
			abortRef.current = null;
		};
	}, [isAdmin, loadOutbox]);

	const handleOutboxAction = async (id: string, action: 'approve' | 'reject') => {
		setOutboxBusyId(id);
		try {
			const res = await fetch('/api/mail/outbox', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, action }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || t('mailErrSend'));
			await loadOutbox();
		} catch (error) {
			void dialog.alert({
				message: error instanceof Error ? error.message : t('mailErrSend'),
				tone: 'danger',
			});
		} finally {
			setOutboxBusyId(null);
		}
	};

	return {
		outbox,
		outboxOpen,
		setOutboxOpen,
		outboxBusyId,
		handleOutboxAction,
	};
}
