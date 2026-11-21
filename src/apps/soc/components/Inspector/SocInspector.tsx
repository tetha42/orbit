'use client';

import React, { useState, useCallback } from 'react';
import { X, Copy, Check, ShieldAlert, FileText, User, Activity, Globe, GitBranch } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { copyToClipboard } from '@/lib/clipboard';
import { useSoc } from '../../context/SocContext';
import { INSPECTOR_I18N } from './i18nInspector';
import { EventInspector } from './panels/EventInspector';
import { IpInspector } from './panels/IpInspector';
import { IncidentInspector } from './panels/IncidentInspector';
import { SessionInspector } from './panels/SessionInspector';
import { FimInspector } from './panels/FimInspector';
import s from './SocInspector.module.css';

export function SocInspector() {
	const {
		inspectorEntity,
		isInspectorOpen,
		closeInspector,
		canManage,
		handleQuickBan,
		handleUnban,
		handleKillSession,
		handleKillUserTerminals,
		handleUpdateIncidentStatus,
		handleExportCaseDossier,
		handleExecutePlaybook,
		setSiemIp,
		setSiemIpOp,
		setActiveTab,
		isSubmitting,
	} = useSoc();
	const { language } = useI18n();
	const copy = INSPECTOR_I18N[language] ?? INSPECTOR_I18N.en;
	const { openApp } = useWindowActions();

	const [copied, setCopied] = useState(false);
	const [notes, setNotes] = useState('');
	const [isSavingNotes, setIsSavingNotes] = useState(false);
	const [fimDiff, setFimDiff] = useState<string | null>(null);
	const [fimLoading, setFimLoading] = useState(false);

	React.useEffect(() => {
		if (inspectorEntity?.type === 'incident') {
			setNotes(inspectorEntity.data.analystNotes || '');
		}
	}, [inspectorEntity]);

	React.useEffect(() => {
		if (inspectorEntity?.type === 'fim') {
			const fim = inspectorEntity.data;
			if (fim.diff) {
				setFimDiff(fim.diff);
			} else if (fim.file) {
				setFimLoading(true);
				fetch(`/api/soc/inspection?action=diff&path=${encodeURIComponent(fim.file)}`)
					.then((r) => r.json())
					.then((d) => {
						setFimDiff(d?.diff?.diff || copy.fimNoDiff);
					})
					.catch(() => {
						setFimDiff(null);
					})
					.finally(() => {
						setFimLoading(false);
					});
			}
		} else {
			setFimDiff(null);
		}
	}, [inspectorEntity, copy.fimNoDiff]);

	const handleCopyJson = useCallback((val: unknown) => {
		let serialized: string;
		try {
			serialized = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
		} catch (err) {
			console.warn('[SoC] Failed to serialize entity for clipboard:', err);
			return;
		}
		void copyToClipboard(serialized).then((ok) => {
			if (!ok) return;
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		});
	}, []);

	if (!isInspectorOpen || !inspectorEntity) {
		return null;
	}

	const filterSiemIp = (ip: string) => {
		setSiemIp(ip);
		setSiemIpOp('eq');
		setActiveTab('siem');
	};

	let title: string = copy.defaultTitle;
	let typeTag = 'INSPECTOR';
	let IconComp = Activity;

	if (inspectorEntity.type === 'event') {
		typeTag = copy.typeEvent;
		title = `Log #${inspectorEntity.data.id} · ${inspectorEntity.data.service}`;
		IconComp = FileText;
	} else if (inspectorEntity.type === 'ip') {
		typeTag = copy.typeIp;
		title = inspectorEntity.data.ip;
		IconComp = Globe;
	} else if (inspectorEntity.type === 'incident') {
		typeTag = copy.typeIncident;
		title = inspectorEntity.data.title;
		IconComp = ShieldAlert;
	} else if (inspectorEntity.type === 'session') {
		typeTag = copy.typeSession;
		title = `${inspectorEntity.data.name} ${inspectorEntity.data.surname}`;
		IconComp = User;
	} else if (inspectorEntity.type === 'fim') {
		typeTag = copy.typeFim;
		title = inspectorEntity.data.file.split('/').pop() || inspectorEntity.data.file;
		IconComp = GitBranch;
	}

	return (
		<aside className={s.inspectorDrawer} aria-label="SoC Entity Inspector">
			<div className={s.inspectorHeader}>
				<div className={s.headerLeft}>
					<div className={s.entityIconBadge}>
						<IconComp size={15} />
					</div>
					<div className={s.headerTitles}>
						<span className={s.entityTypeTag}>{typeTag}</span>
						<span className={s.entityMainTitle} title={title}>
							{title}
						</span>
					</div>
				</div>
				<div className={s.headerActions}>
					<button
						type="button"
						className={s.iconBtn}
						onClick={() => handleCopyJson(inspectorEntity.data)}
						title={copy.copyEntityJson}
					>
						{copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
					</button>
					<button
						type="button"
						className={s.iconBtn}
						onClick={closeInspector}
						title={copy.closeInspector}
					>
						<X size={15} />
					</button>
				</div>
			</div>

			<div className={s.inspectorBody}>
				{inspectorEntity.type === 'event' && (
					<EventInspector
						ev={inspectorEntity.data}
						language={language}
						canManage={canManage}
						isSubmitting={isSubmitting}
						copied={copied}
						copy={copy}
						onCopyJson={handleCopyJson}
						onQuickBan={handleQuickBan}
						onFilterSiemIp={filterSiemIp}
					/>
				)}
				{inspectorEntity.type === 'ip' && (
					<IpInspector
						data={inspectorEntity.data}
						language={language}
						canManage={canManage}
						isSubmitting={isSubmitting}
						copy={copy}
						onQuickBan={handleQuickBan}
						onUnban={handleUnban}
						onFilterSiemIp={filterSiemIp}
					/>
				)}
				{inspectorEntity.type === 'incident' && (
					<IncidentInspector
						inc={inspectorEntity.data}
						notes={notes}
						setNotes={setNotes}
						isSavingNotes={isSavingNotes}
						onSaveNotes={async () => {
							setIsSavingNotes(true);
							await handleUpdateIncidentStatus(inspectorEntity.data.id, inspectorEntity.data.status, notes);
							setIsSavingNotes(false);
						}}
						canManage={canManage}
						isSubmitting={isSubmitting}
						language={language}
						copy={copy}
						onUpdateStatus={handleUpdateIncidentStatus}
						onExecutePlaybook={handleExecutePlaybook}
						onExportDossier={handleExportCaseDossier}
					/>
				)}
				{inspectorEntity.type === 'session' && (
					<SessionInspector
						sess={inspectorEntity.data}
						canManage={canManage}
						isSubmitting={isSubmitting}
						language={language}
						copy={copy}
						onKillSession={handleKillSession}
						onKillUserTerminals={handleKillUserTerminals}
						onOpenMemberProfile={(userId) => openApp('members', { kind: 'member', itemId: userId })}
					/>
				)}
				{inspectorEntity.type === 'fim' && (
					<FimInspector
						fim={inspectorEntity.data}
						fimDiff={fimDiff}
						fimLoading={fimLoading}
						copy={copy}
					/>
				)}
			</div>
		</aside>
	);
}
