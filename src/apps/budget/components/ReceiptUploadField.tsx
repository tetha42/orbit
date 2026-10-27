'use client';

import React from 'react';
import { Check, Paperclip } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import k from './Kasa.module.css';

interface ReceiptUploadFieldProps {
	fisFotoUrl: string | null;
	uploading: boolean;
	onUpload: (file: File | undefined) => void;
	onRemove: () => void;
}

export function ReceiptUploadField({
	fisFotoUrl,
	uploading,
	onUpload,
	onRemove,
}: ReceiptUploadFieldProps) {
	const { t } = useI18n();

	return (
		<div className={ui.field}>
			<span className={ui.fieldLabel}>{t('kasaReceiptLabel')}</span>
			<div className={k.fileRow}>
				<label className={ui.btn} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
					<Paperclip size={14} /> {fisFotoUrl ? t('kasaChangeFile') : t('kasaChooseFile')}
					<input
						type="file"
						hidden
						accept="image/jpeg,image/png,image/webp,application/pdf"
						disabled={uploading}
						onChange={(e) => onUpload(e.target.files?.[0])}
					/>
				</label>
				{uploading && <span className={ui.muted}>{t('loading')}</span>}
				{fisFotoUrl && !uploading && (
					<>
						<a
							className={k.receipt}
							href={fisFotoUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Check size={14} /> {t('kasaReceiptAttached')}
						</a>
						<button type="button" className={ui.btn} onClick={onRemove}>
							{t('dlgRemove')}
						</button>
					</>
				)}
			</div>
		</div>
	);
}
