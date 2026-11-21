import { NextResponse } from 'next/server';
import type { ModuleContract } from './types';
import {
	findContractError,
	getContractLimit,
	getContractErrorKey,
	getContractErrorMessage,
	resolveContractError,
} from './client';

export {
	findContractError,
	getContractLimit,
	getContractErrorKey,
	getContractErrorMessage,
	resolveContractError,
};

export function contractErrorResponse(
	contract: Pick<ModuleContract, 'errorCodes'>,
	code: string,
	overrideMessage?: string,
	extra?: Record<string, unknown>,
	overrideStatus?: number
) {
	const entry = findContractError(contract, code);
	const status = overrideStatus ?? entry?.status ?? 400;
	const message = overrideMessage ?? entry?.description ?? code;
	return NextResponse.json(
		{
			error: message,
			errorCode: code,
			i18nKey: entry?.i18nKey,
			...(extra ?? {}),
		},
		{ status }
	);
}
