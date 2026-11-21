/** Reference number → "2026/005", the way the portal prints it. */
export function documentRef(referenceNumber: number | null | undefined): string {
	const n = Number(referenceNumber) || 0;
	return `${Math.floor(n / 1000)}/${String(n % 1000).padStart(3, '0')}`;
}

export interface DocumentTemplate {
	id: string;
	labelKey: string;
	documentType: string;
	agendaHint: string;
	bodyHint: string;
}

/**
 * The templates the New Document form offers. `documentType` is what the API stores; the
 * text hints are a starting point the member can replace completely.
 */
export const DOCUMENT_TEMPLATES: readonly DocumentTemplate[] = [
	{
		id: 'resolution',
		labelKey: 'decisionsTemplateResolution',
		documentType: 'resolution',
		agendaHint: '1. Agenda item',
		bodyHint: 'The Board of Directors, having convened, has resolved as follows:',
	},
	{
		id: 'petition',
		labelKey: 'decisionsTemplatePetition',
		documentType: 'cover_letter',
		agendaHint: 'Reason for the application',
		bodyHint: 'To the Chair of the Board of Directors,',
	},
	{
		id: 'permission',
		labelKey: 'decisionsTemplatePermission',
		documentType: 'event_permission',
		agendaHint: 'Purpose and date of the event',
		bodyHint: 'I request permission to organize the event described below.',
	},
	{
		id: 'request',
		labelKey: 'decisionsTemplateRequest',
		documentType: 'material_request',
		agendaHint: 'Requested materials and quantities',
		bodyHint: 'I request that the following materials be provided for the event.',
	},
] as const;

export const VERIFICATION_PREFIX = 'ORBIT-DOC-';
