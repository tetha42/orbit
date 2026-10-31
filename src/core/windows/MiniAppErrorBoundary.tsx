'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

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
			const errorMessage = this.state.error?.message || 'Bilinmeyen bir hata oluştu.';
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
						color: 'var(--text-primary, #ffffff)',
						overflowY: 'auto',
					}}
				>
					<div
						style={{
							width: 48,
							height: 48,
							borderRadius: '50%',
							backgroundColor: 'rgba(255, 69, 58, 0.15)',
							color: '#ff453a',
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
							color: 'var(--text-primary, #ffffff)',
						}}
					>
						Uygulama Beklenmedik Bir Hatayla Karşılaştı
					</h2>

					<p
						style={{
							fontSize: 13,
							lineHeight: 1.5,
							maxWidth: 420,
							margin: '0 0 16px 0',
							color: 'var(--text-secondary, #a1a1aa)',
						}}
					>
						<strong>{appId}</strong> uygulaması izole edildi. Orbit masaüstünüz ve diğer açık pencereler güvenle çalışmaya devam ediyor.
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
								backgroundColor: 'var(--accent, #0a84ff)',
								color: '#ffffff',
								border: 'none',
								cursor: 'pointer',
							}}
						>
							<RefreshCw size={14} />
							Yeniden Başlat
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
									color: 'var(--text-primary, #ffffff)',
									border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
									cursor: 'pointer',
								}}
							>
								<X size={14} />
								Kapat
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
								Hata Ayrıntılarını Göster
							</summary>
							<div style={{ marginTop: 8, wordBreak: 'break-all', fontFamily: 'monospace' }}>
								<div style={{ color: '#ff453a', fontWeight: 600, marginBottom: 4 }}>
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
