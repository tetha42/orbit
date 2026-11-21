'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { MailMessageDetail } from '../types';

export interface ComposeInitialState {
	to?: string;
	subject?: string;
	body?: string;
}

export function useMailCompose(activeMessage: MailMessageDetail | null, userEmail: string | null) {
	const { t, language } = useI18n();
	const [isComposeOpen, setIsComposeOpen] = useState(false);
	const [composeInitial, setComposeInitial] = useState<ComposeInitialState | undefined>();

	const handleReply = useCallback(
		(all = false) => {
			if (!activeMessage) return;
			let recipients = activeMessage.from.address || activeMessage.from.name;
			if (all && activeMessage.to) {
				const others = activeMessage.to
					.map((rec) => rec.address)
					.filter((addr) => addr && addr !== userEmail && addr !== recipients);
				if (others.length > 0) recipients += `, ${others.join(', ')}`;
			}
			const subject = activeMessage.subject.startsWith('Re:')
				? activeMessage.subject
				: `Re: ${activeMessage.subject}`;
			const replyHeader = fill(t('mailQuotedReplyHeader'), {
				date: new Date(activeMessage.date).toLocaleString(language),
				name: activeMessage.from.name || activeMessage.from.address || t('mailMemberFallback'),
				address: activeMessage.from.address || '',
			});
			setComposeInitial({
				to: recipients,
				subject,
				body: `\n\n${replyHeader}\n> ${activeMessage.text.replace(/\n/g, '\n> ')}`,
			});
			setIsComposeOpen(true);
		},
		[activeMessage, userEmail, t, language]
	);

	const handleOpenCompose = useCallback(() => {
		setComposeInitial(undefined);
		setIsComposeOpen(true);
	}, []);

	const closeCompose = useCallback(() => {
		setIsComposeOpen(false);
	}, []);

	return {
		isComposeOpen,
		composeInitial,
		handleReply,
		handleOpenCompose,
		closeCompose,
	};
}
