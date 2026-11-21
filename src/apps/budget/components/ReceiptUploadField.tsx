'use client';

import React from 'react';
import { Check, Paperclip } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import k from './Vault.module.css';

interface ReceiptUploadFieldProps {
	receiptUrl: string | null;
	uploading: boolean;
	onUpload: (file: File | undefined) => void;
	onRemove: () => void;
}

export function ReceiptUploadField({
	receiptUrl,
	uploading,
	onUpload,
	onRemove,
}: ReceiptUploadFieldProps) {
	const { t } = useI18n();

	return (
		<div className={ui.field}>
			<span className={ui.fieldLabel}>{t('treasuryReceiptLabel')}</span>
			<div className={k.fileRow}>
				<label className={ui.btn} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
					<Paperclip size={14} /> {receiptUrl ? t('treasuryChangeFile') : t('treasuryChooseFile')}
					<input
						type="file"
						hidden
						accept="image/jpeg,image/png,image/webp,application/pdf"
						disabled={uploading}
						onChange={(e) => onUpload(e.target.files?.[0])}
					/>
				</label>
				{uploading && <span className={ui.muted}>{t('loading')}</span>}
				{receiptUrl && !uploading && (
					<>
						<a
							className={k.receipt}
							href={receiptUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Check size={14} /> {t('treasuryReceiptAttached')}
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
