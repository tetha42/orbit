'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ListFilter, TerminalSquare } from 'lucide-react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { DIALOG_MODAL_Z, isTopModal, registerModal } from '@/lib/client/modalLock';
import { useDraggableSheet } from '@/core/ui/Sheet';
import ui from '@/core/ui/ui.module.css';
import { DialogSelectList } from './DialogSelectList';
import { FOCUSABLE, TONES, type DialogRequest, type DialogTone } from './types';

export function DialogView({
	request,
	onSettle,
}: {
	request: DialogRequest;
	onSettle: (accepted: boolean, value?: string) => void;
}) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const { kind, options } = request;
	const tone: DialogTone = options.tone ?? (kind === 'confirm' ? 'warning' : 'info');
	const { color, Icon: ToneIcon } = TONES[tone];
	const Icon = kind === 'prompt' ? TerminalSquare : kind === 'select' ? ListFilter : ToneIcon;

	const [inputVal, setInputVal] = useState(options.defaultValue ?? '');
	const [selectedVal, setSelectedVal] = useState(
		options.defaultValue ?? options.items?.[0]?.value ?? ''
	);
	const [zIndex, setZIndex] = useState(DIALOG_MODAL_Z);
	const { offset, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(true);

	const titleId = useId();
	const messageId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const confirmRef = useRef<HTMLButtonElement>(null);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const isDangerConfirm = kind === 'confirm' && tone === 'danger';
	const title =
		options.title ??
		(kind === 'confirm' || kind === 'prompt' || kind === 'select'
			? t('dlgConfirmTitle')
			: tone === 'danger'
				? t('dlgErrorTitle')
				: t('dlgNoticeTitle'));

	useEffect(() => {
		const handle = registerModal(DIALOG_MODAL_Z);
		setZIndex(handle.zIndex);
		const previous = document.activeElement as HTMLElement | null;

		if (kind === 'prompt') {
			inputRef.current?.focus();
			inputRef.current?.select();
		} else {
			(isDangerConfirm ? cancelRef : confirmRef).current?.focus();
		}
		if (tone === 'danger' || tone === 'warning') playSystemSound();

		const onKeyDown = (event: KeyboardEvent) => {
			if (!isTopModal(handle.id)) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				onSettle(false);
				return;
			}
			if (event.key !== 'Tab') return;

			const panel = panelRef.current;
			const nodes = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
			if (nodes.length === 0) return;
			const first = nodes[0];
			const last = nodes[nodes.length - 1];
			const active = document.activeElement as HTMLElement | null;

			if (!panel?.contains(active)) {
				event.preventDefault();
				first.focus();
			} else if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};

		window.addEventListener('keydown', onKeyDown, true);
		return () => {
			window.removeEventListener('keydown', onKeyDown, true);
			handle.release();
			previous?.focus?.();
		};
	}, [isDangerConfirm, kind, tone, onSettle, playSystemSound]);

	const confirmLabel = options.confirmLabel ?? (isDangerConfirm ? t('delete') : t('ok'));
	const cancelLabel = options.cancelLabel ?? t('cancel');

	const submitValue = () => {
		if (kind === 'prompt') {
			if (options.required && !inputVal.trim()) return;
			onSettle(true, inputVal);
		} else if (kind === 'select') {
			if (!selectedVal) return;
			onSettle(true, selectedVal);
		} else {
			onSettle(true);
		}
	};

	return (
		<div
			className="dlg-backdrop"
			style={{ zIndex }}
			onMouseDown={(event) => {
				if (event.target === event.currentTarget && kind === 'alert') onSettle(false);
			}}
		>
			<div
				ref={panelRef}
				className="dlg-panel"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={options.message ? messageId : undefined}
				style={{
					...(options.width ? { width: options.width, maxWidth: 'calc(100vw - 32px)' } : {}),
					...(options.height ? { minHeight: options.height } : {}),
					...(offset.x !== 0 || offset.y !== 0
						? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
						: {}),
				}}
			>
				<div
					className="dlg-content"
					onMouseDown={onHeaderMouseDown}
					onDoubleClick={onHeaderDoubleClick}
					style={{ cursor: 'grab' }}
				>
					<div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
						<span
							aria-hidden="true"
							style={{
								width: 44,
								height: 44,
								borderRadius: 14,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color,
								background: `color-mix(in srgb, ${color} 14%, transparent)`,
							}}
						>
							<Icon size={24} strokeWidth={2.2} />
						</span>
					</div>

					<h2
						id={titleId}
						style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, textAlign: 'center', margin: 0 }}
					>
						{title}
					</h2>

					{options.message && (
						<p
							id={messageId}
							style={{
								marginTop: 8,
								fontSize: 12.5,
								lineHeight: 1.5,
								textAlign: 'center',
								color: 'var(--text-secondary)',
								whiteSpace: 'pre-line',
								overflowWrap: 'anywhere',
								cursor: 'auto',
							}}
						>
							{options.message}
						</p>
					)}

					{kind === 'prompt' && (
						<div style={{ marginTop: 12, cursor: 'auto' }}>
							<input
								ref={inputRef}
								type={options.hideText ? 'password' : 'text'}
								className={ui.input}
								value={inputVal}
								placeholder={options.placeholder}
								maxLength={options.maxLength}
								onChange={(e) => setInputVal(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										submitValue();
									}
								}}
							/>
						</div>
					)}

					{kind === 'select' && options.items && (
						<DialogSelectList
							titleId={titleId}
							items={options.items}
							selectedVal={selectedVal}
							onSelect={setSelectedVal}
							onSubmit={(val) => onSettle(true, val)}
						/>
					)}

					{options.body && (
						<div style={{ marginTop: 12, textAlign: 'left', cursor: 'auto' }}>{options.body}</div>
					)}
				</div>

				<div className="dlg-actions">
					{kind !== 'alert' && (
						<button ref={cancelRef} type="button" className="dlg-btn" onClick={() => onSettle(false)}>
							{cancelLabel}
						</button>
					)}
					<button
						ref={confirmRef}
						type="button"
						className={`dlg-btn ${tone === 'danger' && kind === 'confirm' ? 'dlg-btn--danger' : 'dlg-btn--primary'}`}
						onClick={submitValue}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
