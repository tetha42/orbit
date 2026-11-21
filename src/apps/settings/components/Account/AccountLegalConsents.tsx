'use client';

import React from 'react';
import { resolveLocalizedText, useI18n } from '@/core/i18n';
import { LegalDocumentModal, type LegalDocumentContent } from '@/components/Auth/LegalDocumentModal';
import ui from '@/core/ui/ui.module.css';
import styles from './Account.module.css';

interface AccountLegalConsentsProps {
	missingLegal: LegalDocumentContent[];
	activeLegal: LegalDocumentContent | null;
	legalBusy: boolean;
	onReview: (doc: LegalDocumentContent) => void;
	onClose: () => void;
	onAccept: () => void;
}

export function AccountLegalConsents({
	missingLegal,
	activeLegal,
	legalBusy,
	onReview,
	onClose,
	onAccept,
}: AccountLegalConsentsProps) {
	const { t, language } = useI18n();

	return (
		<>
			{missingLegal.length > 0 && (
				<div className={styles.card}>
					<h4 className={styles.cardTitle}>{t('acConsentsTitle')}</h4>
					<p style={{ margin: 0, fontSize: '12px', opacity: 0.65 }}>{t('acConsentsDesc')}</p>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						{missingLegal.map((document) => (
							<div
								key={document.id}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '10px',
									padding: '8px 10px',
									borderRadius: '8px',
									border: '1px solid var(--window-border)',
								}}
							>
								<div style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600 }}>
									{resolveLocalizedText(
										{ en: document.titleEn, tr: document.titleTr },
										language,
										document.titleEn || document.titleTr
									)}
								</div>
								<button
									type="button"
									className={ui.btn}
									onClick={() => onReview(document)}
									disabled={legalBusy}
								>
									{t('acConsentReview')}
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			<LegalDocumentModal document={activeLegal} onClose={onClose} onAccept={onAccept} />
		</>
	);
}
