import type { ContractErrorCode, ModuleContract } from './types';

export function findContractError(
	contract: Pick<ModuleContract, 'errorCodes'>,
	code: string
): ContractErrorCode | undefined {
	return contract.errorCodes.find((e) => e.code === code);
}

export function getContractLimit<T extends number | string | boolean>(
	contract: Pick<ModuleContract, 'limits'>,
	key: string,
	fallback: T
): T {
	const value = contract.limits[key];
	if (typeof value === typeof fallback) {
		return value as T;
	}
	return fallback;
}

export function getContractErrorKey(
	contract: Pick<ModuleContract, 'errorCodes'>,
	code: string
): string | undefined {
	return findContractError(contract, code)?.i18nKey;
}

export function getContractErrorMessage(
	contract: Pick<ModuleContract, 'errorCodes'>,
	code: string,
	t?: (key: string, fallback?: string) => string,
	fallback?: string
): string {
	const entry = findContractError(contract, code);
	const defaultText = fallback ?? entry?.description ?? code;
	if (entry?.i18nKey && t) {
		return t(entry.i18nKey, defaultText);
	}
	return defaultText;
}

export function resolveContractError(
	payload: { error?: unknown; errorCode?: unknown; i18nKey?: unknown } | null | undefined,
	contract: Pick<ModuleContract, 'errorCodes'>,
	t?: (key: string, fallback?: string) => string,
	fallback = 'Operation failed.'
): string {
	const rawError = typeof payload?.error === 'string' && payload.error.trim() ? payload.error : fallback;
	const errorCode = typeof payload?.errorCode === 'string' ? payload.errorCode : undefined;
	const payloadKey = typeof payload?.i18nKey === 'string' ? payload.i18nKey : undefined;

	if (errorCode) {
		const entry = findContractError(contract, errorCode);
		const key = payloadKey ?? entry?.i18nKey;
		if (key && t) {
			return t(key, rawError);
		}
		if (entry?.description && rawError === fallback) {
			return entry.description;
		}
	} else if (payloadKey && t) {
		return t(payloadKey, rawError);
	}

	return rawError;
}
