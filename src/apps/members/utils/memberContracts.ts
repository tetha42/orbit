import membersContract from '../members.contract.json';

export const MEMBER_MAX_BIO_LENGTH = membersContract.limits.maxBioLength;
export const MEMBER_MAX_CUSTOM_FIELDS = membersContract.limits.maxCustomFields;

export function mapMemberContractError(
	code: string | undefined,
	fallback: string,
	t: (key: string, fallback?: string) => string
): string {
	const entry = code ? membersContract.errorCodes.find((item) => item.code === code) : undefined;
	return entry ? t(entry.i18nKey, entry.description) : fallback;
}
