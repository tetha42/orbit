'use client';

import React, { useMemo } from 'react';
import { useSoc } from '../../context/SocContext';
import { formatSocAlertMessage } from '../../utils/i18nAlertLocalization';
import { RADAR_MAIN_I18N } from './radar/i18nRadarMain';
import { RADAR_STREAM_I18N } from './radar/i18nRadarStream';
import { RadarKpiGrid } from './radar/RadarKpiGrid';
import { RadarIncidentBoard } from './radar/RadarIncidentBoard';
import { RadarKillSwitches } from './radar/RadarKillSwitches';
import { RadarIngressDiagnostics } from './radar/RadarIngressDiagnostics';
import { RadarSystemTelemetry } from './radar/RadarSystemTelemetry';
import { RadarTopAttackers } from './radar/RadarTopAttackers';
import { RadarRateLimits } from './radar/RadarRateLimits';
import { RadarLiveStream } from './radar/RadarLiveStream';
import s from '../../Soc.module.css';

export const RadarView = React.memo(function RadarView() {
	const {
		overview,
		sessions,
		incidents,
		siemLogs,
		callerIp,
		ingressDiagnostics,
		canManage,
		isSubmitting,
		language,
		setActiveTab,
		handleToggleKillSwitch,
		handleClearRateLimit,
		handleQuickBan,
		handleUnban,
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
		globalSearch,
		openInspector,
	} = useSoc();

	const mainCopy = RADAR_MAIN_I18N[language] ?? RADAR_MAIN_I18N.en;
	const streamCopy = RADAR_STREAM_I18N[language] ?? RADAR_STREAM_I18N.en;
	const query = globalSearch.trim().toLowerCase();

	const filteredAttackers = useMemo(() => {
		return (overview?.topAttackers ?? []).filter((att) => {
			if (!query) return true;
			return (
				att.ip.toLowerCase().includes(query) ||
				att.lastMessage.toLowerCase().includes(query) ||
				formatSocAlertMessage(att.lastMessage, language).toLowerCase().includes(query) ||
				att.status.toLowerCase().includes(query)
			);
		});
	}, [overview?.topAttackers, query, language]);

	const filteredRateLimits = useMemo(() => {
		return (overview?.metrics.activeRateLimits ?? []).filter((rl) => {
			if (!query) return true;
			return rl.key.toLowerCase().includes(query);
		});
	}, [overview?.metrics.activeRateLimits, query]);

	const filteredLiveEvents = useMemo(() => {
		return siemLogs.filter((ev) => {
			if (!query) return true;
			return (
				(ev.ip && ev.ip.toLowerCase().includes(query)) ||
				ev.message.toLowerCase().includes(query) ||
				ev.service.toLowerCase().includes(query) ||
				ev.level.toLowerCase().includes(query)
			);
		});
	}, [siemLogs, query]);

	return (
		<div className={s.viewContainer}>
			<RadarKpiGrid
				overview={overview}
				sessionsCount={sessions.length}
				callerIp={callerIp}
				copy={mainCopy}
				onOpenFirewall={setActiveTab}
			/>

			<RadarIncidentBoard
				incidents={incidents ?? []}
				language={language}
				copy={mainCopy}
				onSelectDataDoubleClick={handleSelectDataOnDoubleClick}
				onContainerDoubleClick={handleDataContainerDoubleClick}
				openInspector={openInspector}
			/>

			<RadarKillSwitches
				switches={overview?.emergencySwitches}
				canManage={canManage}
				isSubmitting={isSubmitting}
				copy={mainCopy}
				onToggle={handleToggleKillSwitch}
			/>

			{ingressDiagnostics && (
				<RadarIngressDiagnostics
					diagnostics={ingressDiagnostics}
					callerIp={callerIp}
					copy={mainCopy}
				/>
			)}

			{overview?.systemTelemetry && (
				<RadarSystemTelemetry telemetry={overview.systemTelemetry} copy={streamCopy} />
			)}

			<RadarTopAttackers
				attackers={filteredAttackers}
				hasSearchQuery={Boolean(query)}
				callerIp={callerIp}
				canManage={canManage}
				isSubmitting={isSubmitting}
				language={language}
				copy={streamCopy}
				onSelectDataDoubleClick={handleSelectDataOnDoubleClick}
				onContainerDoubleClick={handleDataContainerDoubleClick}
				openInspector={openInspector}
				handleUnban={handleUnban}
				handleQuickBan={handleQuickBan}
			/>

			<RadarRateLimits
				rateLimits={filteredRateLimits}
				canManage={canManage}
				isSubmitting={isSubmitting}
				language={language}
				copy={streamCopy}
				onSelectDataDoubleClick={handleSelectDataOnDoubleClick}
				onContainerDoubleClick={handleDataContainerDoubleClick}
				handleClearRateLimit={handleClearRateLimit}
			/>

			<RadarLiveStream
				events={filteredLiveEvents}
				hasSearchQuery={Boolean(query)}
				language={language}
				copy={streamCopy}
				onOpenSiem={setActiveTab}
				onSelectDataDoubleClick={handleSelectDataOnDoubleClick}
				onContainerDoubleClick={handleDataContainerDoubleClick}
				openInspector={openInspector}
			/>
		</div>
	);
});
