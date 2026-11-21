'use client';

import { useState, useCallback } from 'react';
import type { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { compileForensicDossier, downloadDossierFile } from '../../utils/dossier';
import type {
	InspectorEntity,
	ContextMenuState,
	SoarPlaybookId,
	SoarPlaybookExecutionResult,
	SocIncident,
	SystemLog,
} from '../../types';

interface InspectorSliceDeps {
	dialog: ReturnType<typeof useDialog>;
	showNotice: (type: 'ok' | 'err', text: string) => void;
	incidents: SocIncident[];
	siemLogs: SystemLog[];
	currentUserId: string;
	fetchAll: (silent?: boolean) => Promise<void>;
	runSocAction: (payload: Record<string, unknown>, successMsg: string) => Promise<boolean>;
	setIsSubmitting: (v: boolean) => void;
}

export function useSocInspectorSlice({
	dialog,
	showNotice,
	incidents,
	siemLogs,
	currentUserId,
	fetchAll,
	runSocAction,
	setIsSubmitting,
}: InspectorSliceDeps) {
	const [inspectorEntity, setInspectorEntity] = useState<InspectorEntity | null>(null);
	const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
	const { t } = useI18n();

	const openInspector = useCallback((entity: InspectorEntity) => {
		setInspectorEntity(entity);
		setIsInspectorOpen(true);
	}, []);

	const closeInspector = useCallback(() => {
		setIsInspectorOpen(false);
	}, []);

	const toggleInspector = useCallback(() => {
		setIsInspectorOpen((prev) => !prev);
	}, []);

	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

	const openContextMenu = useCallback(
		(e: React.MouseEvent, type: 'ip' | 'user' | 'service' | 'hash', value: string, meta?: Record<string, unknown>) => {
			e.preventDefault();
			e.stopPropagation();
			setContextMenu({ x: e.clientX, y: e.clientY, type, value, meta });
		},
		[]
	);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	const [forensicLog, setForensicLog] = useState<SystemLog | null>(null);
	const [forensicCopied, setForensicCopied] = useState<boolean>(false);

	const handleOpenForensicLog = useCallback((log: SystemLog) => {
		setForensicLog(log);
		setForensicCopied(false);
	}, []);

	const handleCopyForensic = useCallback(() => {
		if (!forensicLog) return;
		const text = JSON.stringify(forensicLog, null, 2);
		void navigator.clipboard.writeText(text);
		setForensicCopied(true);
		setTimeout(() => setForensicCopied(false), 2000);
	}, [forensicLog]);

	const handleKillUserTerminals = useCallback(
		async (userId: string) => {
			const confirmed = await dialog.confirm({
				title: t('socKillShellsTitle'),
				message: fill(t('socKillShellsMsg'), { userId }),
				tone: 'danger',
				confirmLabel: t('socKillShellsBtn'),
				cancelLabel: t('cancel'),
			});
			if (!confirmed) return false;
			return await runSocAction(
				{ action: 'kill_user_terminals', userId },
				fill(t('socKillShellsSuccess'), { userId })
			);
		},
		[dialog, runSocAction, t]
	);

	const handleExecutePlaybook = useCallback(
		async (
			playbookId: SoarPlaybookId,
			target: { ip?: string; userId?: string; path?: string; incidentId?: string }
		): Promise<SoarPlaybookExecutionResult> => {
			const targetLabel = target.ip || target.userId || target.path || 'system';
			const confirmed = await dialog.confirm({
				title: t('socPlaybookExecTitle'),
				message: fill(t('socPlaybookExecMsg'), { playbookId, target: targetLabel }),
				tone: 'danger',
				confirmLabel: t('socPlaybookExecBtn'),
				cancelLabel: t('cancel'),
			});
			if (!confirmed) {
				return {
					success: false,
					playbookId,
					actionsTaken: [],
					timestamp: Date.now(),
					error: 'Canceled by analyst',
				};
			}

			setIsSubmitting(true);
			try {
				const res = await fetch('/api/soc/playbooks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ playbookId, target }),
				});
				const data = await res.json();
				if (!res.ok) {
					showNotice('err', data.error || t('socPlaybookExecFailed'));
					return (
						data.result || {
							success: false,
							playbookId,
							actionsTaken: [],
							timestamp: Date.now(),
							error: data.error,
						}
					);
				}
				showNotice('ok', fill(t('socPlaybookExecSuccess'), { playbookId }));
				void fetchAll(true);
				return data.result;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				showNotice('err', msg);
				return { success: false, playbookId, actionsTaken: [], timestamp: Date.now(), error: msg };
			} finally {
				setIsSubmitting(false);
			}
		},
		[dialog, showNotice, fetchAll, setIsSubmitting, t]
	);

	const handleExportCaseDossier = useCallback(
		async (incidentId: string) => {
			const inc = incidents.find((i) => i.id === incidentId);
			if (!inc) {
				showNotice('err', t('socIncidentNotFound'));
				return;
			}
			setIsSubmitting(true);
			try {
				const matchingLogs = siemLogs.filter(
					(l) => (inc.sourceIp && l.ip === inc.sourceIp) || (inc.service && l.service === inc.service)
				);
				const dossier = await compileForensicDossier(inc, matchingLogs, currentUserId || 'SOC Analyst');
				downloadDossierFile(dossier);
				showNotice('ok', t('socDossierDownloaded'));
			} catch {
				showNotice('err', t('socDossierFailed'));
			} finally {
				setIsSubmitting(false);
			}
		},
		[incidents, siemLogs, currentUserId, showNotice, setIsSubmitting, t]
	);

	return {
		inspectorEntity,
		isInspectorOpen,
		openInspector,
		closeInspector,
		toggleInspector,
		contextMenu,
		setContextMenu,
		openContextMenu,
		closeContextMenu,
		forensicLog,
		setForensicLog,
		forensicCopied,
		handleOpenForensicLog,
		handleCopyForensic,
		handleKillUserTerminals,
		handleExecutePlaybook,
		handleExportCaseDossier,
	};
}
