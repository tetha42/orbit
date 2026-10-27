'use client';

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, ListFilter, ShieldAlert, TerminalSquare } from 'lucide-react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useIsMounted } from '@/lib/client/useClientValue';
import { DIALOG_MODAL_Z, isTopModal, registerModal } from '@/lib/client/modalLock';
import { useDraggableSheet } from '@/core/ui/Sheet';
import ui from '@/core/ui/ui.module.css';

/**
 * Zenity-style desktop dialog system (`alert`, `confirm`, `prompt`, `select`).
 *
 * Rendered through a portal to `<body>` at `--z-dialog` (`50000+`), above all
 * mini-app windows and sheets, with LIFO keyboard lock, focus trapping, and
 * draggable dialog window chrome.
 */

export type DialogTone = 'info' | 'success' | 'warning' | 'danger';

export interface DialogOptions {
	title?: string;
	/** Plain text; line breaks are kept and the text can be selected and copied. */
	message?: string;
	/** Structured content shown under the message (contact card, shortcut list…). */
	body?: React.ReactNode;
	tone?: DialogTone;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Zenity `--width` parameter. */
	width?: number;
	/** Zenity `--height` parameter. */
	height?: number;
}

export interface PromptDialogOptions extends DialogOptions {
	/** Default value for the Zenity `--entry-text` input. */
	defaultValue?: string;
	placeholder?: string;
	/** Masks input (`zenity --password`). */
	hideText?: boolean;
	maxLength?: number;
	required?: boolean;
}

export interface SelectDialogOption {
	value: string;
	label: string;
	description?: string;
}

export interface SelectDialogOptions extends DialogOptions {
	items: SelectDialogOption[];
	defaultValue?: string;
}

export interface DialogApi {
	alert: (options: DialogOptions | string) => Promise<void>;
	confirm: (options: DialogOptions | string) => Promise<boolean>;
	/** Zenity `--entry` / `--password`: prompts for a text string, or `null` if cancelled. */
	prompt: (options: PromptDialogOptions | string) => Promise<string | null>;
	/** Zenity `--list`: prompts to pick an item from a list, or `null` if cancelled. */
	select: (options: SelectDialogOptions) => Promise<string | null>;
}

type DialogKind = 'alert' | 'confirm' | 'prompt' | 'select';

interface DialogRequest {
	id: number;
	kind: DialogKind;
	options: DialogOptions & Partial<PromptDialogOptions> & Partial<SelectDialogOptions>;
	resolve: (result: { accepted: boolean; value?: string }) => void;
}

const TONES: Record<DialogTone, { color: string; Icon: typeof Info }> = {
	info: { color: '#0a84ff', Icon: Info },
	success: { color: '#30d158', Icon: CheckCircle2 },
	warning: { color: '#ff9f0a', Icon: AlertTriangle },
	danger: { color: '#ff453a', Icon: ShieldAlert },
};

const FOCUSABLE =
	'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
	const ctx = useContext(DialogContext);
	if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
	return ctx;
}

/** Alias for Zenity-style dialog callers. */
export const useZenity = useDialog;

export function DialogProvider({ children }: { children: React.ReactNode }) {
	const { isLocked } = useSession();
	const isMounted = useIsMounted();
	const [queue, setQueue] = useState<DialogRequest[]>([]);
	const nextId = useRef(1);

	const enqueue = useCallback(
		(
			kind: DialogKind,
			options: (DialogOptions & Partial<PromptDialogOptions> & Partial<SelectDialogOptions>) | string
		) =>
			new Promise<{ accepted: boolean; value?: string }>((resolve) => {
				const normalized = typeof options === 'string' ? { message: options } : options;
				setQueue((current) => [
					...current,
					{ id: nextId.current++, kind, options: normalized, resolve },
				]);
			}),
		[]
	);

	const api = useMemo<DialogApi>(
		() => ({
			alert: async (options) => {
				await enqueue('alert', options);
			},
			confirm: async (options) => {
				const res = await enqueue('confirm', options);
				return res.accepted;
			},
			prompt: async (options) => {
				const res = await enqueue('prompt', options);
				return res.accepted ? (res.value ?? '') : null;
			},
			select: async (options) => {
				const res = await enqueue('select', options);
				return res.accepted ? (res.value ?? null) : null;
			},
		}),
		[enqueue]
	);

	// Dialogs raised while several are pending are shown one after another.
	const current = queue[0];

	const settle = useCallback(
		(accepted: boolean, value?: string) => {
			if (!current) return;
			current.resolve({ accepted, value });
			setQueue((items) => items.filter((item) => item.id !== current.id));
		},
		[current]
	);

	return (
		<DialogContext.Provider value={api}>
			{children}
			{/* Held back while the lock screen is up: it sits below dialogs, and an
			    alert appearing over a locked desktop would leak what the user was doing. */}
			{isMounted && current && !isLocked
				? createPortal(<DialogView key={current.id} request={current} onSettle={settle} />, document.body)
				: null}
		</DialogContext.Provider>
	);
}

function DialogView({
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

	// Own the keyboard while open: focus goes into the dialog, Tab cycles inside it,
	// Esc dismisses, and the global shortcuts stand down. Focus returns to whatever
	// had it before, so keyboard users are not dropped at the top of the page.
	useEffect(() => {
		const handle = registerModal(DIALOG_MODAL_Z);
		setZIndex(handle.zIndex);
		const previous = document.activeElement as HTMLElement | null;

		if (kind === 'prompt') {
			inputRef.current?.focus();
			inputRef.current?.select();
		} else {
			// A destructive confirm defaults to Cancel, so a stray Enter cannot delete anything.
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
			// Only an alert can be dismissed by clicking outside; a confirm/prompt/select needs an answer.
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
								background: `${color}24`,
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
						<div
							role="radiogroup"
							aria-labelledby={titleId}
							style={{
								marginTop: 12,
								display: 'flex',
								flexDirection: 'column',
								gap: 6,
								maxHeight: 220,
								overflowY: 'auto',
								cursor: 'auto',
							}}
						>
							{options.items.map((item) => {
								const active = selectedVal === item.value;
								return (
									<button
										key={item.value}
										type="button"
										role="radio"
										aria-checked={active}
										onClick={() => setSelectedVal(item.value)}
										onDoubleClick={() => onSettle(true, item.value)}
										style={{
											display: 'flex',
											flexDirection: 'column',
											alignItems: 'flex-start',
											gap: 2,
											padding: '8px 10px',
											borderRadius: 8,
											border: `1px solid ${active ? 'var(--accent)' : 'var(--card-border)'}`,
											background: active
												? 'color-mix(in srgb, var(--accent) 14%, var(--card-bg))'
												: 'var(--card-bg)',
											color: 'var(--text-primary)',
											textAlign: 'left',
											cursor: 'pointer',
										}}
									>
										<span style={{ fontSize: 12.5, fontWeight: 650 }}>{item.label}</span>
										{item.description && (
											<span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
												{item.description}
											</span>
										)}
									</button>
								);
							})}
						</div>
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
