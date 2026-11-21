export interface OAuthScopeMeta {
	id: string;
	label: string;
	desc: string;
	required: boolean;
}

export interface RevealedOAuthCreds {
	name: string;
	clientId: string;
	clientSecret: string;
}

export const DEFAULT_OAUTH_SCOPES = ['openid', 'profile', 'email', 'academic', 'roles'];

export function buildAvailableScopes(
	t: (key: string, fallback?: string) => string,
): readonly OAuthScopeMeta[] {
	return [
		{ id: 'openid', label: t('oauthScopeOpenid'), desc: t('oauthScopeOpenidDesc'), required: true },
		{ id: 'profile', label: t('oauthScopeProfile'), desc: t('oauthScopeProfileDesc'), required: false },
		{ id: 'email', label: t('oauthScopeEmail'), desc: t('oauthScopeEmailDesc'), required: false },
		{ id: 'academic', label: t('oauthScopeAcademic'), desc: t('oauthScopeAcademicDesc'), required: false },
		{ id: 'roles', label: t('oauthScopeRoles'), desc: t('oauthScopeRolesDesc'), required: false },
	];
}
