'use client';

import { resolveLocalizedText, useI18n } from '@/core/i18n';
import {
	fieldAppliesTo,
	fieldLabel,
	fieldPlaceholder,
	fieldRequiredFor,
	optionLabel,
	type FormField,
} from '@/lib/formFields';
import type { RegistrationCoreConfig } from '@/lib/i18n/data/registrationConfig';
import { CompactField, PasswordInput, TextInput } from '../AuthControls';
import type { LegalDocumentContent } from '../LegalDocumentModal';
import styles from '../AuthPortal.module.css';
import { RegisterTrackPicker } from './RegisterTrackPicker';
import { RegisterLegalSection } from './RegisterLegalSection';

interface RegisterCommunityStepProps {
	coreConfig: RegistrationCoreConfig;
	track: string;
	level: number;
	isTrackOpen: boolean;
	customFields: FormField[];
	customValues: Record<string, string>;
	fieldErrors: Record<string, string>;
	legalDocuments: LegalDocumentContent[];
	acceptedDocuments: Record<string, boolean>;
	legalError: boolean;
	setupIncomplete: boolean;
	loading: boolean;
	onTrackChange: (v: string) => void;
	onLevelChange: (v: number) => void;
	onToggleTrackOpen: () => void;
	onCloseTrack: () => void;
	onCustomValueChange: (key: string, value: string) => void;
	onToggleLegalDoc: (docId: string, checked: boolean) => void;
	onOpenLegalDoc: (doc: LegalDocumentContent) => void;
	onBack: () => void;
}

export function RegisterCommunityStep({
	coreConfig,
	track,
	level,
	isTrackOpen,
	customFields,
	customValues,
	fieldErrors,
	legalDocuments,
	acceptedDocuments,
	legalError,
	setupIncomplete,
	loading,
	onTrackChange,
	onLevelChange,
	onToggleTrackOpen,
	onCloseTrack,
	onCustomValueChange,
	onToggleLegalDoc,
	onOpenLegalDoc,
	onBack,
}: RegisterCommunityStepProps) {
	const { t, language } = useI18n();

	const trackLabel = resolveLocalizedText({ en: coreConfig.track.labelEn, tr: coreConfig.track.labelTr }, language);
	const levelLabel = resolveLocalizedText({ en: coreConfig.level.labelEn, tr: coreConfig.level.labelTr }, language);
	const trackPlaceholder = resolveLocalizedText(
		{ en: coreConfig.track.placeholderEn, tr: coreConfig.track.placeholderTr },
		language
	);
	const regCustomFields = customFields.filter((field) => fieldAppliesTo(field, 'registration'));

	return (
		<div className={styles.wizardPanel}>
			{(coreConfig.track.visible || coreConfig.level.visible) && (
				<div className={styles.fieldRow}>
					{coreConfig.track.visible && (
						<RegisterTrackPicker
							label={trackLabel}
							placeholder={trackPlaceholder}
							options={coreConfig.track.options}
							value={track}
							isOpen={isTrackOpen}
							onToggleOpen={onToggleTrackOpen}
							onClose={onCloseTrack}
							onSelect={onTrackChange}
						/>
					)}
					{coreConfig.level.visible && (
						<CompactField label={levelLabel}>
							<select
								className={styles.select}
								value={level}
								onChange={(e) => onLevelChange(Number(e.target.value))}
							>
								{coreConfig.level.options.map((option) => (
									<option key={option.value} value={Number(option.value)}>
										{optionLabel(option, language)}
									</option>
								))}
							</select>
						</CompactField>
					)}
				</div>
			)}

			{regCustomFields.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
					<div className={styles.wizardSectionLabel}>
						{t('authCustomFieldsSection', 'Additional Member Information')}
					</div>
					{regCustomFields.map((field) => {
						const label = fieldLabel(field, language);
						const placeholder = fieldPlaceholder(field, language);
						const value = customValues[field.fieldKey] ?? '';
						const inputId = `reg-field-${field.fieldKey}`;
						const common = {
							id: inputId,
							name: field.fieldKey,
							required: fieldRequiredFor(field, 'registration'),
							value,
							placeholder,
							'aria-invalid': Boolean(fieldErrors[field.fieldKey]),
						};
						return (
							<div key={field.id}>
								<label htmlFor={inputId} className={`${styles.label} ${styles.labelCompact}`}>
									{label}
									{fieldRequiredFor(field, 'registration') ? ' *' : ''}
								</label>
								{field.type === 'textarea' ? (
									<textarea
										{...common}
										rows={3}
										onChange={(event) => onCustomValueChange(field.fieldKey, event.target.value)}
										style={{
											width: '100%',
											padding: '9px 12px',
											borderRadius: '8px',
											border: '1px solid rgba(255,255,255,0.14)',
											background: 'color-mix(in srgb, var(--ink-bg) 56%, transparent)',
											color: '#fafafa',
											fontSize: '12.5px',
											outline: 'none',
											resize: 'vertical',
											boxSizing: 'border-box',
										}}
									/>
								) : field.type === 'select' ? (
									<select
										{...common}
										onChange={(event) => onCustomValueChange(field.fieldKey, event.target.value)}
										className={styles.select}
									>
										<option value="">{t('authSelectOption', 'Select…')}</option>
										{field.options.map((option) => (
											<option key={option.value} value={option.value}>
												{optionLabel(option, language)}
											</option>
										))}
									</select>
								) : field.type === 'password' ? (
									<PasswordInput
										{...common}
										compact
										autoComplete="new-password"
										onChange={(event) => onCustomValueChange(field.fieldKey, event.target.value)}
									/>
								) : (
									<TextInput
										{...common}
										compact
										type={field.type === 'email' ? 'email' : field.type}
										onChange={(event) => onCustomValueChange(field.fieldKey, event.target.value)}
									/>
								)}
								{fieldErrors[field.fieldKey] && (
									<p role="alert" style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--danger)' }}>
										{fieldErrors[field.fieldKey]}
									</p>
								)}
							</div>
						);
					})}
				</div>
			)}

			<RegisterLegalSection
				legalDocuments={legalDocuments}
				acceptedDocuments={acceptedDocuments}
				legalError={legalError}
				onToggleLegalDoc={onToggleLegalDoc}
				onOpenLegalDoc={onOpenLegalDoc}
			/>

			<div className={styles.wizardActions}>
				<button type="button" className={styles.wizardBack} onClick={onBack}>
					{t('authWizardBack', 'Back')}
				</button>
				<button type="submit" className={styles.wizardPrimary} disabled={setupIncomplete || loading}>
					{loading
						? t('authSendingCode', 'Sending Code...')
						: t('authWizardCreate', 'Create Account & Send Code')}
				</button>
			</div>
			<div className={styles.hint}>
				{t('authRegApprovalHint', 'Your account will be activated once approved by community administrators.')}
			</div>
		</div>
	);
}
