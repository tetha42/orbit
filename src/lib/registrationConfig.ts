import { DEPARTMENTS, EXPERIENCE_LEVELS } from '../data/departments.ts';
import type { FormFieldOption } from './formFields';
import { GRADE_MAX, GRADE_MIN } from './profile.ts';

/**
 * Configuration for the two core registration fields that every member has:
 * the community track and the experience level. They stay first-class columns
 * on `users`; this module only controls how the form presents them.
 *
 * - `visible`: hide the field on the public form and the add-member sheet.
 * - `labelTr` / `labelEn`: the field title.
 * - `options`: the selectable menu. For levels, values must be integers within
 *   `GRADE_MIN..GRADE_MAX` because they are stored in `users.grade`.
 */
export type RegistrationCoreFieldKey = 'track' | 'level';

export interface RegistrationCoreField {
	visible: boolean;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
	options: FormFieldOption[];
}

export interface RegistrationCoreTextField {
	/** The handle stays visible; only whether it is mandatory is configurable. */
	required: boolean;
	labelTr: string;
	labelEn: string;
	placeholderTr: string;
	placeholderEn: string;
}

export interface RegistrationCoreConfig {
	track: RegistrationCoreField;
	level: RegistrationCoreField;
	memberId: RegistrationCoreTextField;
}

export const REGISTRATION_CORE_SETTINGS_KEY = 'registration_core_fields';

const TRACK_OPTIONS: FormFieldOption[] = DEPARTMENTS.map((department) => ({
	value: department.name,
	labelTr: department.name,
	labelEn: department.name,
}));

const LEVEL_OPTIONS: FormFieldOption[] = EXPERIENCE_LEVELS.map((level) => ({
	value: String(level.value),
	labelTr: level.label,
	labelEn: level.label,
}));

export const DEFAULT_REGISTRATION_CORE_CONFIG: RegistrationCoreConfig = {
	track: {
		visible: true,
		labelTr: 'Topluluk Alanı',
		labelEn: 'Community Track',
		placeholderTr: 'Topluluk alanı seçin',
		placeholderEn: 'Select a community track',
		options: TRACK_OPTIONS,
	},
	level: {
		visible: true,
		labelTr: 'Deneyim Seviyesi',
		labelEn: 'Experience Level',
		placeholderTr: 'Deneyim seviyesi seçin',
		placeholderEn: 'Select an experience level',
		options: LEVEL_OPTIONS,
	},
	memberId: {
		required: false,
		labelTr: 'Üye Kimliği / Kullanıcı Adı',
		labelEn: 'Member ID / Handle',
		placeholderTr: 'Örn. alex_dev veya boş bırakın (ORB-XXXXXX)',
		placeholderEn: 'e.g. alex_dev or leave blank (ORB-XXXXXX)',
	},
};

function clean(value: unknown, max = 120): string {
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeOptions(raw: unknown, numericValues: boolean): FormFieldOption[] {
	const list = Array.isArray(raw) ? raw : [];
	const seen = new Set<string>();
	const options: FormFieldOption[] = [];
	for (const item of list.slice(0, 60)) {
		if (!item || typeof item !== 'object') continue;
		const record = item as Record<string, unknown>;
		const value = clean(record.value, 80);
		if (!value || seen.has(value)) continue;
		if (numericValues) {
			const numeric = Number(value);
			if (!Number.isInteger(numeric) || numeric < GRADE_MIN || numeric > GRADE_MAX) continue;
		} else if (value.length < 2 || /[<>\u0000-\u001f]/.test(value)) {
			// These values become `users.department`, which the registration API
			// rejects below two characters and whenever it contains unsafe text.
			continue;
		}
		seen.add(value);
		options.push({
			value,
			labelTr: clean(record.labelTr ?? record.label_tr ?? value) || value,
			labelEn: clean(record.labelEn ?? record.label_en ?? value) || value,
		});
	}
	return options;
}

function normalizeField(
	raw: unknown,
	fallback: RegistrationCoreField,
	numericValues: boolean
): RegistrationCoreField {
	const input =
		raw && typeof raw === 'object' && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	const options = normalizeOptions(input.options, numericValues);
	return {
		visible: input.visible === undefined ? fallback.visible : input.visible !== false,
		labelTr: clean(input.labelTr) || fallback.labelTr,
		labelEn: clean(input.labelEn) || fallback.labelEn,
		placeholderTr: clean(input.placeholderTr, 160) || fallback.placeholderTr,
		placeholderEn: clean(input.placeholderEn, 160) || fallback.placeholderEn,
		options: options.length > 0 ? options : fallback.options,
	};
}

/** Merges a stored/partial configuration with the bundled defaults, never returning empty options. */
export function normalizeRegistrationCoreConfig(raw: unknown): RegistrationCoreConfig {
	const input =
		raw && typeof raw === 'object' && !Array.isArray(raw)
			? (raw as Record<string, unknown>)
			: {};
	const memberIdInput =
		input.memberId && typeof input.memberId === 'object' && !Array.isArray(input.memberId)
			? (input.memberId as Record<string, unknown>)
			: {};
	return {
		track: normalizeField(input.track, DEFAULT_REGISTRATION_CORE_CONFIG.track, false),
		level: normalizeField(input.level, DEFAULT_REGISTRATION_CORE_CONFIG.level, true),
		memberId: {
			required: memberIdInput.required === true,
			labelTr:
				clean(memberIdInput.labelTr) || DEFAULT_REGISTRATION_CORE_CONFIG.memberId.labelTr,
			labelEn:
				clean(memberIdInput.labelEn) || DEFAULT_REGISTRATION_CORE_CONFIG.memberId.labelEn,
			placeholderTr:
				clean(memberIdInput.placeholderTr, 160) ||
				DEFAULT_REGISTRATION_CORE_CONFIG.memberId.placeholderTr,
			placeholderEn:
				clean(memberIdInput.placeholderEn, 160) ||
				DEFAULT_REGISTRATION_CORE_CONFIG.memberId.placeholderEn,
		},
	};
}

export function defaultTrackValue(config: RegistrationCoreConfig): string {
	return config.track.options[0]?.value ?? DEFAULT_REGISTRATION_CORE_CONFIG.track.options[0].value;
}

export function defaultLevelValue(config: RegistrationCoreConfig): number {
	const value = Number(config.level.options[0]?.value ?? DEFAULT_REGISTRATION_CORE_CONFIG.level.options[0].value);
	return Number.isInteger(value) ? value : 1;
}
