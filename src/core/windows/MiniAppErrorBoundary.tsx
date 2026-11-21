'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { translate } from '@/lib/i18n';
import { DEFAULT_LOCALE, normalizeLocale } from '@/locales/registry';

export interface MiniAppErrorBoundaryProps {
	appId: string;
	instanceId?: string;
	onReset?: () => void;
	onClose?: () => void;
	children: ReactNode;
}

interface MiniAppErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

/**
 * Isolates runtime exceptions in a single Mini-App so they do not crash
 * the Orbit Desktop Compositor, Window Manager, or peer windows.
 */
export class MiniAppErrorBoundary extends Component<
	MiniAppErrorBoundaryProps,
	MiniAppErrorBoundaryState
> {
	constructor(props: MiniAppErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<MiniAppErrorBoundaryState> {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		this.setState({ errorInfo });
		console.error(`[MiniAppErrorBoundary:${this.props.appId}] Unhandled application crash:`, error, errorInfo);
	}

	private handleReset = (): void => {
		this.setState({ hasError: false, error: null, errorInfo: null });
		this.props.onReset?.();
	};

	override render(): ReactNode {
		if (this.state.hasError) {
			const { appId, onClose } = this.props;
			const language = normalizeLocale(
				typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : DEFAULT_LOCALE
			);
			const t = (key: string): string => translate(language, key);
			const errorMessage = this.state.error?.message || t('miniAppCrashUnknown');
			const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';

			return (
				<div
					data-miniapp-crash-card=""
					style={{
						height: '100%',
						width: '100%',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '24px',
						boxSizing: 'border-box',
						textAlign: 'center',
						backgroundColor: 'var(--bg-primary, #1e1e1e)',
						color: 'var(--text-primary)',
						overflowY: 'auto',
					}}
				>
					<div
						style={{
							width: 48,
							height: 48,
							borderRadius: '50%',
							backgroundColor: 'color-mix(in srgb, var(--danger) 15%, transparent)',
							color: 'var(--danger)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							marginBottom: 16,
						}}
					>
						<AlertTriangle size={24} />
					</div>

					<h2
						style={{
							fontSize: 16,
							fontWeight: 600,
							margin: '0 0 8px 0',
							color: 'var(--text-primary)',
						}}
					>
						{t('miniAppCrashTitle')}
					</h2>

					<p
						style={{
							fontSize: 13,
							lineHeight: 1.5,
							maxWidth: 420,
							margin: '0 0 16px 0',
							color: 'var(--text-secondary)',
						}}
					>
						<strong>{appId}</strong>
						{t('miniAppCrashBodySuffix')}
					</p>

					<div
						style={{
							display: 'flex',
							gap: 10,
							marginBottom: 20,
						}}
					>
						<button
							type="button"
							onClick={this.handleReset}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 6,
								padding: '8px 16px',
								borderRadius: 8,
								fontSize: 13,
								fontWeight: 500,
								backgroundColor: 'var(--accent)',
								color: '#ffffff',
								border: 'none',
								cursor: 'pointer',
							}}
						>
							<RefreshCw size={14} />
							{t('miniAppCrashRestart')}
						</button>

						{onClose && (
							<button
								type="button"
								onClick={onClose}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 6,
									padding: '8px 16px',
									borderRadius: 8,
									fontSize: 13,
									fontWeight: 500,
									backgroundColor: 'var(--bg-tertiary, #27272a)',
									color: 'var(--text-primary)',
									border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
									cursor: 'pointer',
								}}
							>
								<X size={14} />
								{t('close')}
							</button>
						)}
					</div>

					{errorStack && (
						<details
							style={{
								maxWidth: 480,
								width: '100%',
								textAlign: 'left',
								fontSize: 11,
								color: 'var(--text-muted, #71717a)',
								backgroundColor: 'rgba(0, 0, 0, 0.25)',
								borderRadius: 6,
								padding: '8px 12px',
								boxSizing: 'border-box',
							}}
						>
							<summary style={{ cursor: 'pointer', outline: 'none', userSelect: 'none' }}>
								{t('miniAppCrashDetails')}
							</summary>
							<div style={{ marginTop: 8, wordBreak: 'break-all', fontFamily: 'monospace' }}>
								<div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 4 }}>
									{errorMessage}
								</div>
								<pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto' }}>
									{errorStack}
								</pre>
							</div>
						</details>
					)}
				</div>
			);
		}

		return this.props.children;
	}
}
