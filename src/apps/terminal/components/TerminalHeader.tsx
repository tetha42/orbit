'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	Check,
	Copy,
	RotateCw,
	Trash2,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { TerminalStatus } from '../types';

interface TerminalHeaderProps {
	isLight: boolean;
	isActive: boolean;
	isMinimized: boolean;
	status: TerminalStatus;
	statusMessage: string;
	copied: boolean;
	onCopy: () => void;
	onClear: () => void;
	onRestart: () => void;
}

export function TerminalHeader({
	isLight,
	isActive,
	isMinimized,
	status,
	statusMessage,
	copied,
	onCopy,
	onClear,
	onRestart,
}: TerminalHeaderProps) {
	const { t } = useI18n();
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setPortalTarget(document.getElementById('topbar-app-controls'));
	}, []);

	if (!portalTarget || !isActive || isMinimized) return null;

	return createPortal(
		<div
			onMouseDown={(e) => e.stopPropagation()}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '6px',
				height: '100%',
				paddingLeft: '8px',
				borderLeft: '1px solid var(--topbar-border)',
				fontSize: '11.5px',
				userSelect: 'none',
			}}
		>
			<span
				style={{
					padding: '1px 7px',
					borderRadius: '4px',
					fontSize: '11px',
					fontWeight: 600,
					lineHeight: '16px',
					background:
						status === 'connected'
							? isLight
								? 'rgba(5, 150, 105, 0.14)'
								: 'rgba(0, 230, 118, 0.18)'
							: status === 'connecting'
								? isLight
									? 'rgba(217, 119, 6, 0.14)'
									: 'rgba(255, 190, 11, 0.18)'
								: isLight
									? 'rgba(225, 29, 72, 0.14)'
									: 'rgba(255, 77, 109, 0.2)',
					color:
						status === 'connected'
							? isLight
								? '#059669'
								: '#00e676'
							: status === 'connecting'
								? isLight
									? '#d97706'
									: '#ffbe0b'
								: isLight
									? '#e11d48'
									: '#ff4d6d',
					display: 'inline-flex',
					alignItems: 'center',
					gap: '5px',
					whiteSpace: 'nowrap',
				}}
			>
				<span
					style={{
						width: '6px',
						height: '6px',
						borderRadius: '50%',
						background: 'currentColor',
						boxShadow: status === 'connected' ? '0 0 6px currentColor' : 'none',
					}}
				/>
				{statusMessage}
			</span>

			<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
				<button
					onClick={onCopy}
					title={t('termCopySelection')}
					style={{
						background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.07)',
						border: '1px solid var(--topbar-border)',
						borderRadius: '4px',
						padding: '1px 7px',
						height: '20px',
						color: copied ? (isLight ? '#059669' : '#00e676') : 'var(--topbar-text)',
						cursor: 'pointer',
						display: 'inline-flex',
						alignItems: 'center',
						gap: '4px',
						fontSize: '11px',
						fontWeight: 500,
					}}
				>
					{copied ? <Check size={11} color={isLight ? '#059669' : '#00e676'} /> : <Copy size={11} />}
					<span>{copied ? t('termCopied') : t('termCopy')}</span>
				</button>

				<button
					onClick={onClear}
					title={t('termClearScreen')}
					style={{
						background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.07)',
						border: '1px solid var(--topbar-border)',
						borderRadius: '4px',
						padding: '1px 7px',
						height: '20px',
						color: 'var(--topbar-text)',
						cursor: 'pointer',
						display: 'inline-flex',
						alignItems: 'center',
						gap: '4px',
						fontSize: '11px',
						fontWeight: 500,
					}}
				>
					<Trash2 size={11} />
					<span>{t('termClear')}</span>
				</button>

				<button
					onClick={onRestart}
					title={t('termRestartShell')}
					style={{
						background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.07)',
						border: '1px solid var(--topbar-border)',
						borderRadius: '4px',
						padding: '1px 7px',
						height: '20px',
						color: 'var(--topbar-text)',
						cursor: 'pointer',
						display: 'inline-flex',
						alignItems: 'center',
						gap: '4px',
						fontSize: '11px',
						fontWeight: 500,
					}}
				>
					<RotateCw size={11} />
					<span>{t('refresh')}</span>
				</button>
			</div>
		</div>,
		portalTarget
	);
}
