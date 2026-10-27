'use client';

import { useDialog } from '@/components/Common/DialogProvider';
import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSound } from '@/core/sound';
import { errorMessage } from '@/lib/errors';
import { SmtpInfoCards } from './SmtpInfoCards';
import { SmtpFormFields } from './SmtpFormFields';
import { SmtpTestActions } from './SmtpTestActions';

export function SmtpSettingsPanel() {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();

	const [host, setHost] = useState('');
	const [port, setPort] = useState('465');
	const [secure, setSecure] = useState(true);
	const [user, setUser] = useState('');
	const [pass, setPass] = useState('');
	const [from, setFrom] = useState('');
	const [welcomeTemplate, setWelcomeTemplate] = useState('');
	const [testEmail, setTestEmail] = useState('');

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
	const statusRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		statusRef.current?.scrollIntoView({ block: 'nearest' });
	}, [status]);

	const [hasPassword, setHasPassword] = useState(false);
	const [emailReady, setEmailReady] = useState(false);

	useEffect(() => {
		const loadSmtp = async () => {
			try {
				const res = await fetch('/api/settings/smtp');
				if (res.ok) {
					const data = await res.json();
					if (data.smtp_host) setHost(data.smtp_host);
					if (data.smtp_port) setPort(String(data.smtp_port));
					if (data.smtp_secure !== undefined) setSecure(data.smtp_secure);
					if (data.smtp_user) setUser(data.smtp_user);
					if (data.smtp_from) setFrom(data.smtp_from);
					if (data.mail_welcome_template) setWelcomeTemplate(data.mail_welcome_template);
					setHasPassword(Boolean(data.hasPassword));
					setEmailReady(Boolean(data.emailReady));
				}
			} catch (e) {
				console.error('Failed to load SMTP settings:', e);
			} finally {
				setIsLoading(false);
			}
		};

		void loadSmtp();
	}, []);

	const buildPayload = (extra: Record<string, unknown> = {}) => ({
		smtp_host: host,
		smtp_port: Number(port),
		smtp_secure: secure,
		smtp_user: user,
		smtp_from: from,
		mail_welcome_template: welcomeTemplate,
		...(pass.trim() ? { smtp_pass: pass } : {}),
		...extra,
	});

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setIsSaving(true);
			setStatus(null);

			const res = await fetch('/api/settings/smtp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload()),
			});

			const data = await res.json();
			if (res.ok && data.success) {
				playSystemSound();
				setHasPassword(Boolean(data.hasPassword));
				setEmailReady(Boolean(data.emailReady));
				setPass('');
				setStatus({ text: data.message, type: data.emailReady ? 'success' : 'error' });
			} else {
				setStatus({ text: data.error || t('smtpSaveFailed'), type: 'error' });
			}
		} catch (err) {
			setStatus({ text: errorMessage(err) || t('connError'), type: 'error' });
		} finally {
			setIsSaving(false);
		}
	};

	const handleClearPassword = async () => {
		const confirmed = await dialog.confirm({
			message: t('smtpDeletePassConfirm'),
			tone: 'danger',
			confirmLabel: t('smtpDeletePassBtn'),
		});
		if (!confirmed) return;

		try {
			setIsSaving(true);
			setStatus(null);
			const res = await fetch('/api/settings/smtp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload({ clearPassword: true })),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setHasPassword(false);
				setEmailReady(false);
				setPass('');
				setStatus({ text: t('smtpPassDeleted'), type: 'success' });
			} else {
				setStatus({ text: data.error || t('smtpDeletePassFailed'), type: 'error' });
			}
		} catch (err) {
			setStatus({ text: errorMessage(err) || t('connError'), type: 'error' });
		} finally {
			setIsSaving(false);
		}
	};

	const handleTestEmail = async () => {
		if (!testEmail) {
			setStatus({ text: t('smtpTestEmailRequired'), type: 'error' });
			return;
		}

		try {
			setIsTesting(true);
			setStatus(null);

			const res = await fetch('/api/settings/smtp/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload({ testEmail })),
			});

			const data = await res.json();
			if (res.ok && data.success) {
				playSystemSound();
				setStatus({ text: data.message, type: 'success' });
			} else {
				setStatus({ text: data.error || t('smtpTestFailed'), type: 'error' });
			}
		} catch (err) {
			setStatus({ text: errorMessage(err) || t('smtpTestServerError'), type: 'error' });
		} finally {
			setIsTesting(false);
		}
	};

	if (isLoading) {
		return <div style={{ padding: '24px', opacity: 0.7 }}>{t('smtpLoading')}</div>;
	}

	return (
		<div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Mail size={20} color="var(--accent-blue)" />
					<span>{t('tabSmtp')}</span>
				</h2>
				<p style={{ fontSize: '13px', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
					{t('settingsSmtpDesc')}
				</p>
			</div>

			<SmtpInfoCards from={from} emailReady={emailReady} />

			{status && (
				<div
					ref={statusRef}
					data-mail-status=""
					style={{
						padding: '12px 16px',
						borderRadius: '10px',
						background: status.type === 'success' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
						border: `1px solid ${status.type === 'success' ? 'rgba(52, 199, 89, 0.4)' : 'rgba(255, 69, 58, 0.4)'}`,
						color: status.type === 'success' ? '#34c759' : '#ff453a',
						fontSize: '13px',
						fontWeight: 600,
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
					}}
				>
					{status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
					<span>{status.text}</span>
				</div>
			)}

			<form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
				<SmtpFormFields
					host={host}
					onHostChange={setHost}
					port={port}
					onPortChange={(val) => {
						setPort(val);
						setSecure(val === '465');
					}}
					user={user}
					onUserChange={setUser}
					pass={pass}
					onPassChange={setPass}
					hasPassword={hasPassword}
					onClearPassword={handleClearPassword}
					isSaving={isSaving}
					from={from}
					onFromChange={setFrom}
					welcomeTemplate={welcomeTemplate}
					onWelcomeTemplateChange={setWelcomeTemplate}
				/>

				<SmtpTestActions
					isSaving={isSaving}
					isTesting={isTesting}
					testEmail={testEmail}
					onTestEmailChange={setTestEmail}
					onTestEmail={handleTestEmail}
				/>
			</form>
		</div>
	);
}
