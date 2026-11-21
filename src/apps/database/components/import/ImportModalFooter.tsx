'use client';

import React from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface ImportModalFooterProps {
	step: 1 | 2 | 3;
	isSubmitting: boolean;
	onBack: () => void;
	onClose: () => void;
	onNextFromStep2: () => void;
	onSubmitImport: () => void;
}

export function ImportModalFooter({
	step,
	isSubmitting,
	onBack,
	onClose,
	onNextFromStep2,
	onSubmitImport,
}: ImportModalFooterProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				padding: '14px 20px',
				borderTop: '1px solid var(--window-border)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
			}}
		>
			{step > 1 ? (
				<button
					type="button"
					onClick={onBack}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '6px',
						padding: '7px 14px',
						borderRadius: '6px',
						fontSize: '12px',
						background: 'transparent',
						border: '1px solid var(--window-border)',
						color: 'inherit',
						cursor: 'pointer',
					}}
				>
					<ArrowLeft size={14} />
					<span>{t('back')}</span>
				</button>
			) : (
				<div />
			)}

			<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

				{step === 2 && (
					<button
						type="button"
						onClick={onNextFromStep2}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '7px 16px',
							borderRadius: '6px',
							fontSize: '12px',
							fontWeight: 600,
							background: 'var(--accent)',
							color: 'var(--accent-contrast)',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						<span>{t('next')}</span>
						<ArrowRight size={14} />
					</button>
				)}

				{step === 3 && (
					<button
						type="button"
						onClick={onSubmitImport}
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
						<span>{isSubmitting ? t('dbImportSubmitting') : t('dbImportComplete')}</span>
					</button>
				)}
			</div>
		</div>
	);
}
