'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { Sheet } from '@/core/ui/Sheet';
import { APPLICATION_NOTE_MAX } from '@/lib/teams';
import ui from '@/core/ui/ui.module.css';

/** The note that goes with an application to a team that takes members by approval. */
export function ApplyModal({
	teamName,
	onClose,
	onSend,
}: {
	teamName: string;
	onClose: () => void;
	onSend: (note: string) => Promise<void>;
}) {
	const { t } = useI18n();
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	return (
		<Sheet
			title={t('tmApplyTitle')}
			subtitle={teamName}
			label={t('tmApplyTitle')}
			icon={<Send size={18} color="var(--accent)" />}
			onClose={onClose}
			closeLabel={t('kbClose')}
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				await onSend(note);
				setBusy(false);
			}}
			footer={
				<>
					<button type="button" className={ui.btn} onClick={onClose}>
						{t('tmCancel')}
					</button>
					<button type="submit" className={ui.primaryBtn} disabled={busy}>
						{t('tmSendApplication')}
					</button>
				</>
			}
		>
			<div className={ui.hint}>{t('tmApplyHint')}</div>
			<textarea
				className={ui.textarea}
				autoFocus
				rows={5}
				maxLength={APPLICATION_NOTE_MAX}
				value={note}
				onChange={(e) => setNote(e.target.value)}
				placeholder={t('tmApplyPh')}
			/>
		</Sheet>
	);
}
