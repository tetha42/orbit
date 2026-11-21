'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/core/i18n';
import socContract from '../../soc.contract.json';
import { resolveContractError } from '@/contracts/client';
import type { SocIncident, SocIncidentStatus, SocIncidentSeverity } from '../../types';
import { executeUpdateIncidentStatus, executeCreateIncident } from '../../actions/incidentActions';

interface IncidentsSliceDeps {
	canManage: boolean;
	showNotice: (type: 'ok' | 'err', text: string) => void;
}

export function useSocIncidentsSlice({ canManage, showNotice }: IncidentsSliceDeps) {
	const [incidents, setIncidents] = useState<SocIncident[]>([]);
	const { t } = useI18n();

	const handleUpdateIncidentStatus = useCallback(
		async (id: string, status: SocIncidentStatus, analystNotes?: string) => {
			if (!canManage) return false;
			try {
				const result = await executeUpdateIncidentStatus(id, status, analystNotes);
				if (!result.ok) {
					showNotice(
						'err',
						resolveContractError(result.data, socContract, t, result.error || t('socIncidentUpdateFailed'))
					);
					return false;
				}
				setIncidents((prev) =>
					prev.map((inc) =>
						inc.id === id
							? {
									...inc,
									status,
									analystNotes: analystNotes !== undefined ? analystNotes : inc.analystNotes,
									updatedAt: Date.now(),
								}
							: inc
					)
				);
				showNotice('ok', t('socIncidentUpdated'));
				return true;
			} catch {
				showNotice('err', t('socNetworkError'));
				return false;
			}
		},
		[canManage, showNotice, t]
	);

	const handleCreateIncident = useCallback(
		async (data: {
			title: string;
			severity: SocIncidentSeverity;
			sourceIp?: string;
			service?: string;
			analystNotes?: string;
		}) => {
			if (!canManage) return;
			try {
				const result = await executeCreateIncident(data);
				if (!result.ok) {
					showNotice(
						'err',
						resolveContractError(result.data, socContract, t, result.error || t('socIncidentCreateFailed'))
					);
					return;
				}
				const incident = result.data?.incident as SocIncident | undefined;
				if (incident) {
					setIncidents((prev) => [incident, ...prev]);
					showNotice('ok', t('socIncidentCreated'));
				}
			} catch {
				showNotice('err', t('socNetworkError'));
			}
		},
		[canManage, showNotice, t]
	);

	return {
		incidents,
		setIncidents,
		handleUpdateIncidentStatus,
		handleCreateIncident,
	};
}
