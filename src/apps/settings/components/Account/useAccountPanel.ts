'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/i18n/data/registrationConfig';
import type { FormField, FormFieldOption } from '@/lib/formFields';
import type { UserSummary } from '@/db';
import { useShell } from '@/core/shell';
import { useDialog } from '@/components/Common/DialogProvider';
import type { LegalDocumentContent } from '@/components/Auth/LegalDocumentModal';
import { useAccountEmailChange } from './useAccountEmailChange';

export interface ProfileResponse {
	user: {
		id: string;
		name: string;
		surname: string;
		email: string;
		studentNo: string | null;
		department: string;
		grade: number;
		roleInfo: { id: string; name: string; color: string } | null;
		profilePhoto?: string | null;
		bio?: string | null;
		xp: number;
		creation: number;
	};
	level: { level: number; progress: number; next: number };
	summary: UserSummary;
	fields?: FormField[];
	customFields?: Record<string, string>;
	diskUsage?: { bytes: number; count: number };
}

export function useAccountPanel() {
	const { refreshSession, logout } = useSession();
	const { resetWorkspaceSession } = useShell();
	const dialog = useDialog();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const { data, refetch } = useJsonResource<ProfileResponse>('/api/profile');
	const [resetMessage, setResetMessage] = useState<string | null>(null);

	const [department, setDepartment] = useState<string | null>(null);
	const [grade, setGrade] = useState<number | null>(null);
	const [bio, setBio] = useState<string | null>(null);
	const [levelOptions, setLevelOptions] = useState<FormFieldOption[]>(
		DEFAULT_REGISTRATION_CORE_CONFIG.level.options
	);
	const [trackOptions, setTrackOptions] = useState<FormFieldOption[]>(
		DEFAULT_REGISTRATION_CORE_CONFIG.track.options
	);
	const [busy, setBusy] = useState<'' | 'profile' | 'photo' | 'password'>('');
	const [msg, setMsg] = useState<{
		area: 'profile' | 'photo' | 'password';
		text: string;
		tone: 'ok' | 'err';
	} | null>(null);
	const [customValues, setCustomValues] = useState<Record<string, string>>({});
	const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
	const [missingLegal, setMissingLegal] = useState<LegalDocumentContent[]>([]);
	const [activeLegal, setActiveLegal] = useState<LegalDocumentContent | null>(null);
	const [legalBusy, setLegalBusy] = useState(false);

	useEffect(() => {
		if (!msg || msg.tone === 'err') return;
		const id = setTimeout(() => setMsg(null), 3500);
		return () => clearTimeout(id);
	}, [msg]);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/registration-config', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (cancelled) return;
				if (Array.isArray(payload?.config?.level?.options)) {
					setLevelOptions(payload.config.level.options);
				}
				if (Array.isArray(payload?.config?.track?.options)) {
					setTrackOptions(payload.config.track.options);
				}
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (data?.customFields) setCustomValues(data.customFields);
	}, [data]);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/legal/status', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (!cancelled && Array.isArray(payload?.documents)) setMissingLegal(payload.documents);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	const done = async (area: 'profile' | 'photo' | 'password', ok: boolean, text: string) => {
		setBusy('');
		setMsg({ area, text, tone: ok ? 'ok' : 'err' });
		if (ok) {
			playSystemSound();
			await Promise.all([refetch(), refreshSession()]);
		}
	};

	const emailChange = useAccountEmailChange({
		onChanged: async (text) => {
			setMsg({ area: 'profile', text, tone: 'ok' });
			await Promise.all([refetch(), refreshSession()]);
		},
	});

	const handleResetWorkspace = async () => {
		const confirmed = await dialog.confirm({
			message: t('settingsResetConfirm'),
			tone: 'warning',
			confirmLabel: t('dlgReset'),
		});
		if (confirmed) {
			await resetWorkspaceSession();
			setResetMessage(t('settingsResetDone'));
			setTimeout(() => setResetMessage(null), 3000);
		}
	};

	const saveProfile = async (
		e: React.FormEvent,
		values: { department: string; grade: number; bio: string }
	) => {
		e.preventDefault();
		setBusy('profile');
		setCustomErrors({});
		let ok = false;
		let message = t('kbActionFailed');
		try {
			const res = await fetch('/api/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...values, customFields: customValues }),
			});
			const payload = await res.json().catch(() => null);
			ok = res.ok;
			message = payload?.error || message;
			if (!ok && payload?.fieldErrors) setCustomErrors(payload.fieldErrors);
			if (ok) {
				setDepartment(null);
				setGrade(null);
				setBio(null);
			}
		} catch {
			ok = false;
		}
		await done('profile', ok, ok ? t('acSaved') : message);
	};

	const acceptLegalDocument = async () => {
		if (!activeLegal || legalBusy) return;
		setLegalBusy(true);
		try {
			const res = await fetch('/api/legal/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ documentIds: [activeLegal.id] }),
			});
			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.error || t('acConsentFailed'));
			setMissingLegal(Array.isArray(payload?.documents) ? payload.documents : []);
			setActiveLegal(null);
			playSystemSound();
			setMsg({ area: 'profile', text: t('acConsentAccepted'), tone: 'ok' });
		} catch (error) {
			setMsg({
				area: 'profile',
				text: error instanceof Error ? error.message : t('acConsentFailed'),
				tone: 'err',
			});
		} finally {
			setLegalBusy(false);
		}
	};

	return {
		data,
		logout,
		resetMessage,
		handleResetWorkspace,
		department,
		setDepartment,
		grade,
		setGrade,
		bio,
		setBio,
		levelOptions,
		trackOptions,
		busy,
		setBusy,
		msg,
		customValues,
		setCustomValues,
		customErrors,
		missingLegal,
		activeLegal,
		setActiveLegal,
		legalBusy,
		done,
		saveProfile,
		acceptLegalDocument,
		emailChange,
	};
}
