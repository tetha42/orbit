export interface AuthorizeUserData {
	id: string;
	name?: string;
	surname?: string;
	nameSurname: string;
	email: string;
	studentNo?: string;
	department?: string;
	grade?: number;
	profilePhoto?: string | null;
	bio?: string | null;
	roleName?: string;
	xp?: number;
}

export interface AuthorizeClientData {
	id: string;
	name: string;
	description: string;
	logoUrl?: string;
	trusted?: boolean;
}

export interface AuthorizeState {
	loading: boolean;
	error: string | null;
	requiresLogin: boolean;
	requiresConsent: boolean;
	user?: AuthorizeUserData;
	client?: AuthorizeClientData;
	allowedScopes?: string[];
	requestedScopes?: string[];
	effectiveScopes?: string[];
	scope?: string;
}
