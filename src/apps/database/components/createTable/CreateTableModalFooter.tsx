'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface CreateTableModalFooterProps {
	isSubmitting: boolean;
	onClose: () => void;
	onSubmit: () => void;
}

export function CreateTableModalFooter({
	isSubmitting,
	onClose,
	onSubmit,
}: CreateTableModalFooterProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				padding: '14px 20px',
				borderTop: '1px solid var(--window-border)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'flex-end',
				gap: '8px',
			}}
		>
			<button
				type="button"
				onClick={onClose}
				style={{
					padding: '7px 14px',
					borderRadius: '6px',
					fontSize: '12px',
					background: 'transparent',
					border: '1px solid var(--window-border)',
					color: 'inherit',
					cursor: 'pointer',
				}}
			>
				{t('cancel')}
			</button>

			<button
				type="button"
				onClick={onSubmit}
				disabled={isSubmitting}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '6px',
					padding: '7px 18px',
					borderRadius: '6px',
					fontSize: '12px',
					fontWeight: 700,
					background: 'var(--accent)',
					color: 'var(--accent-contrast)',
					border: 'none',
					cursor: isSubmitting ? 'not-allowed' : 'pointer',
					opacity: isSubmitting ? 0.7 : 1,
				}}
			>
				<Check size={14} strokeWidth={3} />
				<span>{isSubmitting ? t('dbCreatingTable') : t('dbCreateTableSubmit')}</span>
			</button>
		</div>
	);
}
