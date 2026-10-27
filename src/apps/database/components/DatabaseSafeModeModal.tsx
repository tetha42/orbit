'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, Check } from 'lucide-react';

interface DatabaseSafeModeModalProps {
	dangerousCommand?: string;
	reason?: string;
	targetTable?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export function DatabaseSafeModeModal({
	dangerousCommand,
	reason,
	targetTable,
	onConfirm,
	onCancel,
}: DatabaseSafeModeModalProps) {
	const [challengeInput, setChallengeInput] = useState('');

	const requiredText = targetTable || 'ONAYLIYORUM';
	const isMatched = challengeInput.trim().toUpperCase() === requiredText.toUpperCase();

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 250,
				background: 'var(--modal-scrim)',
				backdropFilter: 'blur(10px)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '20px',
			}}
		>
			<div
				style={{
					width: '540px',
					maxWidth: '100%',
					background: 'var(--modal-surface)',
					border: '1.5px solid color-mix(in srgb, var(--danger) 60%, var(--window-border))',
					borderRadius: '14px',
					boxShadow: 'var(--shadow-panel)',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
					color: 'var(--text-primary)',
				}}
			>
				{/* Header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '16px 20px',
						background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
						borderBottom: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
						<ShieldAlert size={22} color="var(--danger)" />
						<div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--danger)' }}>
							Safe Mode Güvenlik Kalkanı Devrede!
						</div>
					</div>
					<button
						type="button"
						onClick={onCancel}
						style={{
							background: 'transparent',
							border: 'none',
							color: 'var(--text-primary)',
							cursor: 'pointer',
							padding: '4px',
							opacity: 0.7,
						}}
					>
						<X size={18} />
					</button>
				</div>

				{/* Body */}
				<div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
					<div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
						<AlertTriangle size={24} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
						<div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
							{reason || 'Bu sorgu veritabanınızda geri döndürülemez toplu veri kaybına veya şema bozulmasına yol açabilir.'}
						</div>
					</div>

					{dangerousCommand && (
						<div
							style={{
								padding: '8px 12px',
								borderRadius: '6px',
								background: 'var(--fill-softer)',
								border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
								fontSize: '11.5px',
								fontFamily: 'monospace',
								color: 'var(--danger)',
							}}
						>
							Tespit Edilen Kritik İşlem: <strong>{dangerousCommand}</strong>
						</div>
					)}

					<div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>
						Eğer bu sorguyu bilinçli olarak çalıştırmak istiyorsanız aşağıdaki kutuya tam olarak{' '}
						<strong style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>{requiredText}</strong> yazınız:
					</div>

					<input
						type="text"
						value={challengeInput}
						onChange={(e) => setChallengeInput(e.target.value)}
						placeholder={requiredText}
						style={{
							background: 'var(--input-bg)',
							border: isMatched ? '1.5px solid var(--success)' : '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
							borderRadius: '6px',
							padding: '9px 12px',
							fontSize: '13px',
							fontFamily: 'monospace',
							color: 'var(--text-primary)',
							outline: 'none',
						}}
					/>
				</div>

				{/* Footer */}
				<div
					style={{
						padding: '14px 20px',
						background: 'var(--fill-softer)',
						borderTop: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'flex-end',
						gap: '10px',
					}}
				>
					<button
						type="button"
						onClick={onCancel}
						style={{
							padding: '7px 14px',
							borderRadius: '6px',
							fontSize: '12px',
							background: 'transparent',
							border: '1px solid var(--window-border)',
							color: 'var(--text-primary)',
							cursor: 'pointer',
						}}
					>
						İptal Et & Durdur
					</button>

					<button
						type="button"
						onClick={onConfirm}
						disabled={!isMatched}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '7px 16px',
							borderRadius: '6px',
							fontSize: '12px',
							fontWeight: 700,
							background: isMatched ? 'var(--danger)' : 'color-mix(in srgb, var(--danger) 25%, transparent)',
							color: isMatched ? 'var(--accent-contrast)' : 'var(--text-secondary)',
							border: 'none',
							cursor: isMatched ? 'pointer' : 'not-allowed',
							boxShadow: isMatched ? '0 4px 16px color-mix(in srgb, var(--danger) 40%, transparent)' : undefined,
						}}
					>
						<Check size={14} strokeWidth={3} />
						<span>Riskleri Onaylıyorum, Çalıştır</span>
					</button>
				</div>
			</div>
		</div>
	);
}
