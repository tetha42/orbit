'use client';

import React from 'react';
import { AlignLeft, Pencil } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { Linkified } from '@/components/Common/Linkified';
import ui from '@/core/ui/ui.module.css';

interface TaskDescriptionProps {
	aciklama: string | null;
	canWork: boolean;
	descDraft: string | null;
	setDescDraft: (draft: string | null) => void;
	onSaveDesc: () => void;
}

export function TaskDescription({
	aciklama,
	canWork,
	descDraft,
	setDescDraft,
	onSaveDesc,
}: TaskDescriptionProps) {
	const { t } = useI18n();

	return (
		<section>
			<h5 className={ui.sectionTitle}>
				<AlignLeft size={13} />
				{t('kbDesc')}
				{canWork && descDraft === null && (
					<button
						type="button"
						className={ui.iconBtn}
						onClick={() => setDescDraft(aciklama ?? '')}
						aria-label={t('kbEdit')}
						title={t('kbEdit')}
					>
						<Pencil size={13} />
					</button>
				)}
			</h5>
			{descDraft !== null ? (
				<>
					<textarea
						className={ui.textarea}
						value={descDraft}
						autoFocus
						rows={6}
						onChange={(e) => setDescDraft(e.target.value)}
						placeholder={t('kbDescPh')}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void onSaveDesc();
						}}
					/>
					<div className={ui.btnRow} style={{ marginTop: 8 }}>
						<button type="button" className={ui.btn} onClick={() => setDescDraft(null)}>
							{t('kbCancel')}
						</button>
						<button type="button" className={ui.primaryBtn} style={{ height: 30 }} onClick={onSaveDesc}>
							{t('kbSave')}
						</button>
					</div>
				</>
			) : aciklama ? (
				<div className={ui.descView}>
					<Linkified text={aciklama} />
				</div>
			) : (
				<div className={ui.muted}>{t('kbNoDesc')}</div>
			)}
		</section>
	);
}
