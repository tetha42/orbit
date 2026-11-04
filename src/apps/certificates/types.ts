export interface Certificate {
	id: string;
	verificationCode: string;
	userId: string;
	userNameSurname: string;
	eventId: string | null;
	title: string;
	category?: string | null;
	language?: string | null;
	description?: string | null;
	issuanceDate: number;
	pdfUrl: string | null;
}

export interface MemberRankItem {
	id: string;
	firstName?: string;
	lastName?: string;
	department?: string;
	grade?: number;
	roleName?: string | null;
	teamName?: string | null;
	name: string;
	surname: string;
	xp: number;
}
