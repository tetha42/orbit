'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';

interface IssueModalFooterProps {
	onClose: () => void;
	isSubmitting: boolean;
}

export function IssueModalFooter({ onClose, isSubmitting }: IssueModalFooterProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
			<button
				type="button"
				onClick={onClose}
				style={{
					padding: '9px 16px',
					borderRadius: '8px',
					border: '1px solid rgba(255, 255, 255, 0.15)',
					background: 'transparent',
					color: 'inherit',
					fontSize: '13px',
					fontWeight: 600,
					cursor: 'pointer',
				}}
			>
				{t('cancel')}
			</button>
			<button
				type="submit"
				disabled={isSubmitting}
				style={{
					padding: '9px 18px',
					borderRadius: '8px',
					border: 'none',
					background: 'var(--accent)',
					color: 'var(--accent-contrast, #ffffff)',
					fontSize: '13px',
					fontWeight: 700,
					cursor: isSubmitting ? 'not-allowed' : 'pointer',
					opacity: isSubmitting ? 0.6 : 1,
				}}
			>
				{isSubmitting ? t('certsIssuing') : t('certsIssueSubmitBtn')}
			</button>
		</div>
	);
}
