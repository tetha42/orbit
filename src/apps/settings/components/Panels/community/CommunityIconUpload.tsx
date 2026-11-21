'use client';

import React, { useRef } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface CommunityIconUploadProps {
	siteName: string;
	iconUrl: string | null;
	iconBusy: boolean;
	disabled?: boolean;
	onUploadIcon: (file: File) => void;
	onRemoveIcon: () => void;
}

export function CommunityIconUpload({
	siteName,
	iconUrl,
	iconBusy,
	disabled = false,
	onUploadIcon,
	onRemoveIcon,
}: CommunityIconUploadProps) {
	const { t } = useI18n();
	const iconInputRef = useRef<HTMLInputElement>(null);
	const controlsDisabled = iconBusy || disabled;

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '14px',
				padding: '12px',
				borderRadius: '10px',
				background: 'rgba(255,255,255,0.03)',
				border: '1px solid var(--window-border)',
				flexWrap: 'wrap',
			}}
		>
			<div
				style={{
					width: '64px',
					height: '64px',
					borderRadius: '14px',
					background: 'rgba(0,0,0,0.25)',
					border: '1px solid var(--window-border)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					overflow: 'hidden',
					flexShrink: 0,
				}}
			>
				{iconUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={iconUrl}
						alt={siteName || 'Site Icon'}
						style={{ width: '100%', height: '100%', objectFit: 'cover' }}
					/>
				) : (
					<ImageIcon size={24} style={{ opacity: 0.45 }} />
				)}
			</div>

			<div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
				<input
					ref={iconInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
					style={{ display: 'none' }}
					onChange={(event) => {
						const file = event.target.files?.[0];
						event.currentTarget.value = '';
						if (file) onUploadIcon(file);
					}}
				/>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
					<button
						type="button"
						disabled={controlsDisabled}
						onClick={() => iconInputRef.current?.click()}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '7px 12px',
							borderRadius: '8px',
							border: '1px solid var(--window-border)',
							background: 'rgba(255,255,255,0.08)',
							color: 'inherit',
							fontSize: '12.5px',
							fontWeight: 500,
							cursor: controlsDisabled ? 'not-allowed' : 'pointer',
							opacity: controlsDisabled ? 0.6 : 1,
						}}
					>
						<Upload size={14} />
						{t('identityIconUpload')}
					</button>

					{iconUrl && (
						<button
							type="button"
							disabled={controlsDisabled}
							onClick={onRemoveIcon}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								padding: '7px 12px',
								borderRadius: '8px',
								border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
								background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
								color: 'var(--danger)',
								fontSize: '12.5px',
								fontWeight: 500,
								cursor: controlsDisabled ? 'not-allowed' : 'pointer',
								opacity: controlsDisabled ? 0.6 : 1,
							}}
						>
							<Trash2 size={14} />
							{t('identityIconRemove')}
						</button>
					)}
				</div>
				<div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
					<div>{t('identityIconHint')}</div>
					<div style={{ marginTop: '2px', opacity: 0.8 }}>{t('identityIconPwaHint')}</div>
				</div>
			</div>
		</div>
	);
}
