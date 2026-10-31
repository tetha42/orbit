'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { FormField } from '@/lib/formFields';
import { Mail, Lock, Phone, Calendar, Hash, AlignLeft, List, Type } from 'lucide-react';

interface FormPreviewProps {
	fields: FormField[];
	previewMode?: 'registration' | 'profile';
	activeDraftKey?: string;
}

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 10px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.25)',
	color: 'inherit',
	fontSize: '12px',
	boxSizing: 'border-box',
	outline: 'none',
	transition: 'border-color 0.15s ease',
};

const getFieldIcon = (type: string) => {
	switch (type) {
		case 'email':
			return <Mail size={12} style={{ opacity: 0.6 }} />;
		case 'password':
			return <Lock size={12} style={{ opacity: 0.6 }} />;
		case 'tel':
			return <Phone size={12} style={{ opacity: 0.6 }} />;
		case 'date':
			return <Calendar size={12} style={{ opacity: 0.6 }} />;
		case 'number':
			return <Hash size={12} style={{ opacity: 0.6 }} />;
		case 'textarea':
			return <AlignLeft size={12} style={{ opacity: 0.6 }} />;
		case 'select':
			return <List size={12} style={{ opacity: 0.6 }} />;
		default:
			return <Type size={12} style={{ opacity: 0.6 }} />;
	}
};

/**
 * Modern read-only rendering of the registration form or member profile view.
 * Highlights the actively edited field and reflects live settings.
 */
export function FormPreview({
	fields,
	previewMode = 'registration',
	activeDraftKey,
}: FormPreviewProps) {
	const { t, language } = useI18n();

	// Filter fields depending on the active preview context
	const visible = fields.filter((field) => {
		if (!field.enabled) return false;
		if (previewMode === 'registration') {
			return field.collectAt === 'registration' || field.collectAt === 'both';
		}
		// Member profile: selfEditable or collected in admin/profile
		return field.selfEditable || field.collectAt === 'admin' || field.collectAt === 'both';
	});

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '12px',
				background: 'var(--window-bg, rgba(20, 20, 25, 0.95))',
				borderRadius: '12px',
				padding: '14px',
				border: '1px solid var(--window-border)',
				boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
			}}
		>
			{/* Mock Browser/Window Header */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					paddingBottom: '10px',
					borderBottom: '1px solid var(--window-border)',
				}}
			>
				<div style={{ display: 'flex', gap: '5px' }}>
					<span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56' }} />
					<span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} />
					<span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f' }} />
				</div>
				<span
					style={{
						fontSize: '10.5px',
						fontWeight: 600,
						opacity: 0.6,
						textTransform: 'uppercase',
						letterSpacing: '0.04em',
					}}
				>
					{previewMode === 'registration'
						? t('formPreviewModeReg')
						: t('formPreviewModeProfile')}
				</span>
				<div style={{ width: 32 }} />
			</div>

			{visible.length === 0 ? (
				<div
					style={{
						padding: '30px 10px',
						textAlign: 'center',
						fontSize: '11.5px',
						opacity: 0.55,
					}}
				>
					{t('formPreviewEmpty')}
				</div>
			) : (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
					{visible.map((field) => {
						const isActivelyEditing = activeDraftKey && field.fieldKey === activeDraftKey;
						const label =
							language === 'tr'
								? field.labelTr || field.labelEn
								: field.labelEn || field.labelTr;
						const placeholder =
							language === 'tr'
								? field.placeholderTr || field.placeholderEn
								: field.placeholderEn || field.placeholderTr;
						const isRequired =
							previewMode === 'registration'
								? field.requiredAt === 'registration' ||
									field.requiredAt === 'both' ||
									field.required
								: field.requiredAt === 'admin' ||
									field.requiredAt === 'both' ||
									field.required;
						const id = `preview-${field.id || field.fieldKey || 'draft'}`;

						return (
							<div
								key={id}
								style={{
									display: 'flex',
									flexDirection: 'column',
									gap: '5px',
									padding: isActivelyEditing ? '8px' : '0px',
									borderRadius: '8px',
									background: isActivelyEditing
										? 'var(--accent-subtle, rgba(99, 102, 241, 0.12))'
										: 'transparent',
									border: isActivelyEditing
										? '1px solid var(--accent)'
										: '1px solid transparent',
									transition: 'all 0.15s ease',
								}}
							>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: '6px',
									}}
								>
									<label
										htmlFor={id}
										style={{
											display: 'flex',
											alignItems: 'center',
											gap: '5px',
											fontSize: '11.5px',
											fontWeight: 600,
											opacity: 0.85,
										}}
									>
										{getFieldIcon(field.type)}
										<span>{label}</span>
										{isRequired && <span style={{ color: '#ff453a' }}>*</span>}
									</label>
									{isActivelyEditing && (
										<span
											style={{
												fontSize: '9.5px',
												padding: '2px 5px',
												borderRadius: '4px',
												background: 'var(--accent)',
												color: '#fff',
												fontWeight: 600,
											}}
										>
											Editing
										</span>
									)}
								</div>

								{field.type === 'textarea' ? (
									<textarea
										id={id}
										style={{ ...inputStyle, minHeight: '56px', resize: 'none' }}
										placeholder={placeholder}
										disabled
									/>
								) : field.type === 'select' ? (
									<select id={id} style={inputStyle} disabled>
										<option value="">{placeholder || t('formPreviewSelect')}</option>
										{field.options.map((option) => (
											<option key={option.value} value={option.value}>
												{language === 'tr'
													? option.labelTr || option.labelEn
													: option.labelEn || option.labelTr}
											</option>
										))}
									</select>
								) : (
									<input
										id={id}
										type={
											field.type === 'email'
												? 'email'
												: field.type === 'number'
													? 'number'
													: field.type === 'date'
														? 'date'
														: field.type === 'tel'
															? 'tel'
															: field.type === 'password'
																? 'password'
																: 'text'
										}
										style={inputStyle}
										placeholder={placeholder}
										disabled
									/>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
