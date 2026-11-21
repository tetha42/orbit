'use client';

import React from 'react';
import { ArrowDown, ArrowUp, GripVertical, Search, Type } from 'lucide-react';
import { fieldLabel as getFieldLabel, type FormField } from '@/lib/formFields';
import { cardStyle, FIELD_TYPE_ICONS, inputStyle } from './styles';

interface FieldListSidebarProps {
	fields: FormField[];
	filteredFields: FormField[];
	activeId: string | null;
	draft: FormField | null;
	searchQuery: string;
	setSearchQuery: (q: string) => void;
	selectField: (field: FormField) => void;
	toggleFieldEnabled: (field: FormField) => Promise<void>;
	moveField: (fieldId: string, direction: -1 | 1) => Promise<void>;
	language: 'tr' | 'en';
	t: (key: string, fallback?: string) => string;
}

export function FieldListSidebar({
	fields,
	filteredFields,
	activeId,
	draft,
	searchQuery,
	setSearchQuery,
	selectField,
	toggleFieldEnabled,
	moveField,
	language,
	t,
}: FieldListSidebarProps) {
	return (
		<div style={{ ...cardStyle, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
				<div style={{ fontSize: '12px', fontWeight: 700 }}>{t('formSectionCustom')}</div>
				<span style={{ fontSize: '10.5px', opacity: 0.55 }}>
					{fields.filter((f) => f.enabled).length}/{fields.length} {t('formActiveCount')}
				</span>
			</div>

			<div style={{ position: 'relative' }}>
				<Search
					size={13}
					style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
				/>
				<input
					style={{ ...inputStyle, paddingLeft: '28px', fontSize: '11.5px', height: '32px' }}
					placeholder={t('formQuickSearch')}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '520px', overflowY: 'auto' }}>
				{filteredFields.map((field, index) => {
					const active = field.id === activeId || (!field.id && activeId === null && Boolean(draft));
					const isRequired = field.requiredAt !== 'none' || field.required;
					return (
						<div
							key={field.id || index}
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
								padding: '6px 8px',
								borderRadius: '8px',
								border: active ? '1px solid var(--accent)' : '1px solid var(--window-border)',
								background: active ? 'var(--accent-subtle, color-mix(in srgb, var(--indigo) 14%, transparent))' : 'rgba(255,255,255,0.02)',
								transition: 'all 0.15s ease',
							}}
						>
							<GripVertical size={13} style={{ opacity: 0.35, cursor: 'grab', flexShrink: 0 }} />
							<button
								type="button"
								onClick={() => selectField(field)}
								style={{
									flex: 1,
									minWidth: 0,
									display: 'flex',
									flexDirection: 'column',
									gap: '2px',
									border: 'none',
									background: 'transparent',
									color: 'inherit',
									textAlign: 'left',
									cursor: 'pointer',
									padding: 0,
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: active ? 600 : 500 }}>
									<span style={{ opacity: 0.7, flexShrink: 0 }}>
										{FIELD_TYPE_ICONS[field.type] || <Type size={13} />}
									</span>
									<span
										style={{
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
											flex: 1,
											opacity: field.enabled ? 1 : 0.45,
										}}
									>
										{getFieldLabel(field, language)}
									</span>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
									<span
										style={{
											fontSize: '9.5px',
											padding: '1px 5px',
											borderRadius: '4px',
											background: isRequired ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'rgba(255,255,255,0.06)',
											color: isRequired ? 'var(--danger)' : 'inherit',
											opacity: 0.8,
										}}
									>
										{isRequired ? t('formBadgeRequired') : t('formBadgeOptional')}
									</span>
									<span style={{ fontSize: '9.5px', opacity: 0.45, fontFamily: 'monospace' }}>
										{field.fieldKey}
									</span>
								</div>
							</button>
							<input
								type="checkbox"
								checked={field.enabled}
								onChange={() => void toggleFieldEnabled(field)}
								title={t('formEnabled')}
								style={{ cursor: 'pointer' }}
							/>
							<div style={{ display: 'flex', flexDirection: 'column' }}>
								<button
									type="button"
									onClick={() => void moveField(field.id, -1)}
									disabled={index === 0}
									style={{
										border: 'none',
										background: 'transparent',
										color: 'inherit',
										cursor: index === 0 ? 'default' : 'pointer',
										opacity: index === 0 ? 0.2 : 0.7,
										padding: '0 2px',
									}}
								>
									<ArrowUp size={11} />
								</button>
								<button
									type="button"
									onClick={() => void moveField(field.id, 1)}
									disabled={index === fields.length - 1}
									style={{
										border: 'none',
										background: 'transparent',
										color: 'inherit',
										cursor: index === fields.length - 1 ? 'default' : 'pointer',
										opacity: index === fields.length - 1 ? 0.2 : 0.7,
										padding: '0 2px',
									}}
								>
									<ArrowDown size={11} />
								</button>
							</div>
						</div>
					);
				})}
				{filteredFields.length === 0 && (
					<div style={{ fontSize: '11.5px', opacity: 0.55, textAlign: 'center', padding: '24px 8px' }}>
						{t('formEmpty')}
					</div>
				)}
			</div>
		</div>
	);
}
