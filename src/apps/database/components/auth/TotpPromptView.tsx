'use client';

import React from 'react';
import { Database, Lock, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface TotpPromptViewProps {
	isLight: boolean;
	idleExpired?: boolean;
	code: string;
	loading: boolean;
	error: string | null;
	inputRef: React.RefObject<HTMLInputElement | null>;
	onCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onSubmit: (e?: React.FormEvent) => void;
}

export function TotpPromptView({
	isLight,
	idleExpired,
	code,
	loading,
	error,
	inputRef,
	onCodeChange,
	onSubmit,
}: TotpPromptViewProps) {
	const { t } = useI18n();
	const surfaceBg = isLight ? '#ffffff' : '#0f141f';
	const outerBg = isLight ? '#f8fafc' : '#080b11';
	const textColor = isLight ? '#0f172a' : '#f8fafc';
	const mutedColor = isLight ? '#64748b' : '#94a3b8';

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				height: '100%',
				padding: '2rem',
				background: outerBg,
				color: textColor,
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '380px',
					padding: '2rem',
					borderRadius: '16px',
					background: surfaceBg,
					border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
					boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
					textAlign: 'center',
				}}
			>
				<div
					style={{
						width: '52px',
						height: '52px',
						borderRadius: '14px',
						background: 'var(--accent-subtle)',
						border: '1px solid var(--accent-border)',
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: 'var(--accent)',
						marginBottom: '1rem',
					}}
				>
					{idleExpired ? <Lock size={26} color="var(--warning)" /> : <Database size={26} />}
				</div>

				<h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
					{idleExpired ? t('db2faTimeoutTitle') : t('db2faLockTitle')}
				</h3>

				<p style={{ fontSize: '0.8125rem', color: mutedColor, lineHeight: 1.45, margin: '0 0 1.5rem 0' }}>
					{idleExpired ? t('db2faTimeoutDesc') : t('db2faPromptDesc')}
				</p>

				<form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
					<input
						ref={inputRef}
						type="text"
						inputMode="numeric"
						autoComplete="one-time-code"
						placeholder="••••••"
						maxLength={8}
						value={code}
						onChange={onCodeChange}
						disabled={loading}
						style={{
							width: '100%',
							padding: '0.75rem 1rem',
							textAlign: 'center',
							fontSize: '1.5rem',
							fontFamily: 'ui-monospace, monospace',
							letterSpacing: '0.35em',
							borderRadius: '8px',
							border: error
								? '1px solid var(--danger)'
								: isLight
									? '1px solid #cbd5e1'
									: '1px solid #1e293b',
							background: isLight ? '#f1f5f9' : '#141a29',
							color: textColor,
							outline: 'none',
						}}
					/>

					{error && (
						<div style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500, marginTop: '-0.25rem' }}>
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={code.length < 6 || loading}
						style={{
							padding: '0.75rem',
							borderRadius: '8px',
							background: code.length >= 6 && !loading ? 'var(--accent)' : 'var(--accent-muted)',
							color: 'var(--accent-contrast, #ffffff)',
							border: 'none',
							fontWeight: 600,
							fontSize: '0.875rem',
							cursor: code.length >= 6 && !loading ? 'pointer' : 'not-allowed',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							gap: '0.5rem',
							transition: 'all 0.15s ease',
						}}
					>
						{loading ? (
							<>
								<Loader2 size={16} className="animate-spin" />
								<span>{t('db2faVerifying')}</span>
							</>
						) : (
							<span>{t('db2faUnlock')}</span>
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
