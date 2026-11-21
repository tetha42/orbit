import type React from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

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

export type DialogKind = 'alert' | 'confirm' | 'prompt' | 'select';

export interface DialogRequest {
	id: number;
	kind: DialogKind;
	options: DialogOptions & Partial<PromptDialogOptions> & Partial<SelectDialogOptions>;
	resolve: (result: { accepted: boolean; value?: string }) => void;
}

export const TONES: Record<DialogTone, { color: string; Icon: typeof Info }> = {
	info: { color: 'var(--info)', Icon: Info },
	success: { color: 'var(--success)', Icon: CheckCircle2 },
	warning: { color: 'var(--warning)', Icon: AlertTriangle },
	danger: { color: 'var(--danger)', Icon: ShieldAlert },
};

export const FOCUSABLE =
	'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
