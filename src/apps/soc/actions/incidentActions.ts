import type { SocIncidentSeverity, SocIncidentStatus } from '../types';
import { postSocAction } from './sessionActions';

export async function executeUpdateIncidentStatus(
	id: string,
	status: SocIncidentStatus,
	analystNotes?: string
) {
	return postSocAction({
		action: 'update_incident',
		id,
		status,
		analystNotes,
	});
}

export async function executeCreateIncident(data: {
	title: string;
	severity: SocIncidentSeverity;
	sourceIp?: string;
	service?: string;
	analystNotes?: string;
}) {
	return postSocAction({
		action: 'create_incident',
		...data,
	});
}
