'use client';

import React from 'react';
import {
	AlignLeft,
	Calendar,
	Hash,
	List,
	Lock,
	Mail,
	Phone,
	Type,
} from 'lucide-react';
import type { FormFieldOption, FormFieldType } from '@/lib/formFields';

export const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 11px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.22)',
	color: 'inherit',
	fontSize: '12.5px',
	outline: 'none',
	boxSizing: 'border-box',
	transition: 'border-color 0.15s ease',
};

export const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.85,
	marginBottom: '5px',
};

export const cardStyle: React.CSSProperties = {
	padding: '14px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
};

export const FIELD_TYPE_ICONS: Record<FormFieldType, React.ReactNode> = {
	text: <Type size={13} />,
	password: <Lock size={13} />,
	textarea: <AlignLeft size={13} />,
	number: <Hash size={13} />,
	email: <Mail size={13} />,
	tel: <Phone size={13} />,
	date: <Calendar size={13} />,
	select: <List size={13} />,
};

export interface PresetOption {
	label: string;
	options: FormFieldOption[];
}

// Preset option labels are static seed data and intentionally English-only.
export function buildPresets(t: (key: string, fallback?: string) => string): Record<string, PresetOption> {
	return {
		sizes: {
			label: t('formPresetSizes'),
			options: [
				{ value: 'xs', labelTr: 'XS', labelEn: 'XS' },
				{ value: 's', labelTr: 'S', labelEn: 'S' },
				{ value: 'm', labelTr: 'M', labelEn: 'M' },
				{ value: 'l', labelTr: 'L', labelEn: 'L' },
				{ value: 'xl', labelTr: 'XL', labelEn: 'XL' },
				{ value: 'xxl', labelTr: 'XXL', labelEn: 'XXL' },
			],
		},
		blood: {
			label: t('formPresetBlood'),
			options: [
				{ value: 'a_pos', labelTr: 'A Rh+', labelEn: 'A Rh+' },
				{ value: 'a_neg', labelTr: 'A Rh-', labelEn: 'A Rh-' },
				{ value: 'b_pos', labelTr: 'B Rh+', labelEn: 'B Rh+' },
				{ value: 'b_neg', labelTr: 'B Rh-', labelEn: 'B Rh-' },
				{ value: 'ab_pos', labelTr: 'AB Rh+', labelEn: 'AB Rh+' },
				{ value: 'ab_neg', labelTr: 'AB Rh-', labelEn: 'AB Rh-' },
				{ value: '0_pos', labelTr: '0 Rh+', labelEn: '0 Rh+' },
				{ value: '0_neg', labelTr: '0 Rh-', labelEn: '0 Rh-' },
			],
		},
		grades: {
			label: t('formPresetGrades'),
			options: [
				{ value: 'prep', labelTr: 'Prep', labelEn: 'Prep' },
				{ value: 'grade_1', labelTr: '1st Grade', labelEn: '1st Grade' },
				{ value: 'grade_2', labelTr: '2nd Grade', labelEn: '2nd Grade' },
				{ value: 'grade_3', labelTr: '3rd Grade', labelEn: '3rd Grade' },
				{ value: 'grade_4', labelTr: '4th Grade', labelEn: '4th Grade' },
				{ value: 'graduate', labelTr: 'Graduate / PhD', labelEn: 'Graduate / PhD' },
			],
		},
		yesNo: {
			label: t('formPresetYesNo'),
			options: [
				{ value: 'yes', labelTr: 'Yes', labelEn: 'Yes' },
				{ value: 'no', labelTr: 'No', labelEn: 'No' },
			],
		},
	};
}
