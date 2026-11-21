'use client';

import { resolveLocalizedText, useI18n } from '@/core/i18n';
import type { LegalDocumentContent } from '../LegalDocumentModal';

interface RegisterLegalSectionProps {
	legalDocuments: LegalDocumentContent[];
	acceptedDocuments: Record<string, boolean>;
	legalError: boolean;
	onToggleLegalDoc: (docId: string, checked: boolean) => void;
	onOpenLegalDoc: (doc: LegalDocumentContent) => void;
}

export function RegisterLegalSection({
	legalDocuments,
	acceptedDocuments,
	legalError,
	onToggleLegalDoc,
	onOpenLegalDoc,
}: RegisterLegalSectionProps) {
	const { t, language } = useI18n();

	return (
		<>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
				{legalDocuments.map((document) => {
					const accepted = Boolean(acceptedDocuments[document.id]);
					return (
						<label
							key={document.id}
							style={{
								display: 'flex',
								alignItems: 'flex-start',
								gap: '8px',
								fontSize: '11.5px',
								cursor: 'pointer',
								color: '#d4d4d8',
								lineHeight: 1.4,
							}}
						>
							<input
								type="checkbox"
								checked={accepted}
								aria-invalid={legalError && document.required && !accepted}
								onChange={(event) => onToggleLegalDoc(document.id, event.target.checked)}
								style={{ cursor: 'pointer', marginTop: '2px', accentColor: '#fafafa', flexShrink: 0 }}
							/>
							<span>
								{t('authLegalReadPrefix', 'I have read and accept')}{' '}
								<button
									type="button"
									onClick={(event) => {
										event.preventDefault();
										onOpenLegalDoc(document);
									}}
									style={{
										background: 'none',
										border: 'none',
										color: '#fafafa',
										textDecoration: 'underline',
										cursor: 'pointer',
										padding: 0,
										font: 'inherit',
										fontWeight: 600,
									}}
								>
									{resolveLocalizedText({ en: document.titleEn, tr: document.titleTr }, language)}
								</button>
								{!document.required && (
									<span style={{ opacity: 0.55 }}> ({t('authOptional', 'optional')})</span>
								)}
							</span>
						</label>
					);
				})}
			</div>

			{legalError && (
				<p role="alert" style={{ marginTop: 6, fontSize: 11.5, color: 'var(--danger)' }}>
					{t('authLegalError', 'Please accept all required agreements to continue.')}
				</p>
			)}
		</>
	);
}
