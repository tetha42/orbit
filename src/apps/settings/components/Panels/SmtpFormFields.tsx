'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { Eye, EyeOff } from 'lucide-react';

interface SmtpFormFieldsProps {
	host: string;
	onHostChange: (val: string) => void;
	port: string;
	onPortChange: (val: string) => void;
	user: string;
	onUserChange: (val: string) => void;
	pass: string;
	onPassChange: (val: string) => void;
	hasPassword: boolean;
	onClearPassword: () => void;
	isSaving: boolean;
	from: string;
	onFromChange: (val: string) => void;
	welcomeTemplate?: string;
	onWelcomeTemplateChange?: (val: string) => void;
}

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 12px',
	borderRadius: '8px',
	background: 'rgba(0, 0, 0, 0.25)',
	border: '1px solid var(--window-border)',
	color: 'inherit',
	fontSize: '13px',
};

const labelStyle: React.CSSProperties = {
	fontSize: '12px',
	opacity: 0.8,
	display: 'block',
	marginBottom: '6px',
	fontWeight: 600,
};

export function SmtpFormFields({
	host,
	onHostChange,
	port,
	onPortChange,
	user,
	onUserChange,
	pass,
	onPassChange,
	hasPassword,
	onClearPassword,
	isSaving,
	from,
	onFromChange,
	welcomeTemplate,
	onWelcomeTemplateChange,
}: SmtpFormFieldsProps) {
	const { t } = useI18n();
	const [showPass, setShowPass] = useState(false);

	return (
		<>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
				<div>
					<label style={labelStyle}>{t('smtpHostLabel')}</label>
					<input
						type="text"
						placeholder="smtp.gmail.com"
						value={host}
						onChange={(e) => onHostChange(e.target.value)}
						required
						style={inputStyle}
					/>
				</div>
				<div>
					<label style={labelStyle}>{t('smtpPortLabel')}</label>
					<select
						value={port}
						onChange={(e) => onPortChange(e.target.value)}
						style={inputStyle}
					>
						<option value="465">{t('smtpPortSsl')}</option>
						<option value="587">587 (TLS)</option>
					</select>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<div>
					<label style={labelStyle}>{t('smtpUserLabel')}</label>
					<input
						type="email"
						placeholder="community@example.org"
						value={user}
						onChange={(e) => onUserChange(e.target.value)}
						required
						style={inputStyle}
					/>
				</div>

				<div>
					<label style={labelStyle}>{t('smtpPassLabel')}</label>
					<div style={{ position: 'relative' }}>
						<input
							type={showPass ? 'text' : 'password'}
							placeholder={hasPassword ? t('smtpSavedPassword') : 'abcd efgh ijkl mnop'}
							value={pass}
							onChange={(e) => onPassChange(e.target.value)}
							style={{
								...inputStyle,
								paddingRight: '36px',
								fontFamily: showPass ? 'monospace' : 'inherit',
								letterSpacing: showPass ? '1px' : 'normal',
							}}
						/>
						<button
							type="button"
							onClick={() => setShowPass(!showPass)}
							style={{
								position: 'absolute',
								right: '8px',
								top: '50%',
								transform: 'translateY(-50%)',
								background: 'transparent',
								border: 'none',
								color: 'inherit',
								opacity: 0.6,
								cursor: 'pointer',
								display: 'grid',
								placeItems: 'center',
							}}
						>
							{showPass ? <EyeOff size={15} /> : <Eye size={15} />}
						</button>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px' }}>
						<span style={{ fontSize: '11px', opacity: 0.65 }}>
							{hasPassword
								? t('smtpPasswordSavedHint')
								: t('smtpNoPasswordSaved')}
						</span>
						{hasPassword && (
							<button
								type="button"
								onClick={onClearPassword}
								disabled={isSaving}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#ff453a',
									fontSize: '11px',
									fontWeight: 600,
									cursor: isSaving ? 'wait' : 'pointer',
									padding: 0,
								}}
							>
								{t('smtpDeletePassBtn')}
							</button>
						)}
					</div>
				</div>
			</div>

			<div>
				<label style={labelStyle}>{t('smtpFromLabel')}</label>
				<input
					type="text"
					placeholder={t('smtpFromPh')}
					value={from}
					onChange={(e) => onFromChange(e.target.value)}
					required
					style={inputStyle}
				/>
				<div style={{ fontSize: '11.5px', opacity: 0.6, marginTop: '4px' }}>
					{t('smtpFromExample')}
				</div>
			</div>

			<div>
				<label style={labelStyle}>{t('smtpWelcomeTemplateLabel')}</label>
				<textarea
					rows={3}
					placeholder={t('smtpWelcomeTemplatePh')}
					value={welcomeTemplate || ''}
					onChange={(e) => onWelcomeTemplateChange?.(e.target.value)}
					style={{
						...inputStyle,
						resize: 'vertical',
						lineHeight: 1.5,
					}}
				/>
				<div style={{ fontSize: '11.5px', opacity: 0.6, marginTop: '4px' }}>
					{t('smtpWelcomeTemplateHint')}
				</div>
			</div>
		</>
	);
}
