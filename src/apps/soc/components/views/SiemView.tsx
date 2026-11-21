'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import { SIEM_I18N } from './siem/i18nSiem';
import { SiemHeader } from './siem/SiemHeader';
import { SiemTimeWindowBar } from './siem/SiemTimeWindowBar';
import { SiemHistogram } from './siem/SiemHistogram';
import { SiemOmnibar } from './siem/SiemOmnibar';
import { SiemSecondaryFilters } from './siem/SiemSecondaryFilters';
import { SiemActiveChips } from './siem/SiemActiveChips';
import { SiemLogRow } from './siem/SiemLogRow';
import { SiemPagination } from './siem/SiemPagination';
import s from '../../Soc.module.css';
import siem from '../../SocSiem.module.css';

export const SiemView = React.memo(function SiemView() {
	const {
		siemLogs,
		siemTotalCount,
		siemPage,
		siemLimit,
		siemTotalPages,
		siemHistogram,
		selectedBucket,
		liveTail,
		setLiveTail,
		isLoading,
		canManage,
		callerIp,
		isSubmitting,
		siemTimeRange,
		siemStartTime,
		siemEndTime,
		handleSelectTimeRange,
		handleZoomBucket,
		setShowCustomDateModal,
		siemSearchField,
		setSiemSearchField,
		siemSearchOp,
		setSiemSearchOp,
		siemSearch,
		setSiemSearch,
		fetchSiemFiltered,
		siemService,
		setSiemService,
		siemServiceOp,
		setSiemServiceOp,
		siemLevel,
		setSiemLevel,
		siemLevelOp,
		setSiemLevelOp,
		siemIp,
		setSiemIp,
		siemIpOp,
		setSiemIpOp,
		handleQuickExcludeLevel,
		handleQuickExcludeService,
		handleQuickExcludeIp,
		handleResetAllFilters,
		expandedLogIds,
		toggleLogDetail,
		openInspector,
		handlePivotFilter,
		handleQuickBan,
		handleExportSiem,
		handleLimitChange,
		handlePageChange,
		pageJump,
		setPageJump,
		handlePageJumpSubmit,
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
	} = useSoc();
	const { language } = useI18n();
	const copy = SIEM_I18N[language] ?? SIEM_I18N.en;

	return (
		<div className={s.viewContainer}>
			<section className={s.card}>
				<SiemHeader
					eventsCount={siemLogs.length}
					liveTail={liveTail}
					copy={copy}
					onExport={handleExportSiem}
					onToggleLiveTail={() => setLiveTail((v) => !v)}
				/>

				<SiemTimeWindowBar
					siemTimeRange={siemTimeRange}
					siemStartTime={siemStartTime}
					siemEndTime={siemEndTime}
					selectedBucket={selectedBucket}
					language={language}
					copy={copy}
					onSelectTimeRange={handleSelectTimeRange}
					onOpenCustomModal={() => setShowCustomDateModal(true)}
				/>

				<SiemHistogram
					siemHistogram={siemHistogram}
					selectedBucket={selectedBucket}
					language={language}
					copy={copy}
					onZoomBucket={handleZoomBucket}
				/>

				<div className={siem.siemConsole}>
					<SiemOmnibar
						siemSearchField={siemSearchField}
						setSiemSearchField={setSiemSearchField}
						siemSearchOp={siemSearchOp}
						setSiemSearchOp={setSiemSearchOp}
						siemSearch={siemSearch}
						setSiemSearch={setSiemSearch}
						isLoading={isLoading}
						copy={copy}
						onFetch={fetchSiemFiltered}
					/>

					<SiemSecondaryFilters
						siemService={siemService}
						setSiemService={setSiemService}
						siemServiceOp={siemServiceOp}
						setSiemServiceOp={setSiemServiceOp}
						siemLevel={siemLevel}
						setSiemLevel={setSiemLevel}
						siemLevelOp={siemLevelOp}
						setSiemLevelOp={setSiemLevelOp}
						siemIp={siemIp}
						setSiemIp={setSiemIp}
						siemIpOp={siemIpOp}
						setSiemIpOp={setSiemIpOp}
						siemSearch={siemSearch}
						copy={copy}
						onFetch={fetchSiemFiltered}
						onResetAll={handleResetAllFilters}
					/>

					<SiemActiveChips
						siemTimeRange={siemTimeRange}
						siemStartTime={siemStartTime}
						siemService={siemService}
						setSiemService={setSiemService}
						siemServiceOp={siemServiceOp}
						setSiemServiceOp={setSiemServiceOp}
						siemLevel={siemLevel}
						setSiemLevel={setSiemLevel}
						siemLevelOp={siemLevelOp}
						setSiemLevelOp={setSiemLevelOp}
						siemIp={siemIp}
						setSiemIp={setSiemIp}
						siemIpOp={siemIpOp}
						setSiemIpOp={setSiemIpOp}
						siemSearch={siemSearch}
						setSiemSearch={setSiemSearch}
						siemSearchField={siemSearchField}
						siemSearchOp={siemSearchOp}
						language={language}
						copy={copy}
						onSelectTimeRange={handleSelectTimeRange}
						onFetch={fetchSiemFiltered}
					/>
				</div>

				{siemLogs.length === 0 ? (
					<div className={s.emptyState}>{copy.emptyState}</div>
				) : (
					<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>{copy.thTimestamp}</th>
									<th>{copy.thLevel}</th>
									<th>{copy.thService}</th>
									<th>{copy.thEvent}</th>
									<th>IP</th>
									{canManage && <th>{copy.thAction}</th>}
								</tr>
							</thead>
							<tbody>
								{siemLogs.map((log) => (
									<SiemLogRow
										key={log.id}
										log={log}
										isExpanded={expandedLogIds.has(log.id)}
										canManage={canManage}
										callerIp={callerIp}
										isSubmitting={isSubmitting}
										language={language}
										copy={copy}
										onSelectData={handleSelectDataOnDoubleClick}
										onQuickExcludeLevel={handleQuickExcludeLevel}
										onQuickExcludeService={handleQuickExcludeService}
										onQuickExcludeIp={handleQuickExcludeIp}
										onOpenInspector={openInspector}
										onToggleDetail={toggleLogDetail}
										onPivotFilter={handlePivotFilter}
										onQuickBan={handleQuickBan}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}

				{siemLogs.length > 0 && (
					<SiemPagination
						siemPage={siemPage}
						siemLimit={siemLimit}
						siemTotalCount={siemTotalCount}
						siemTotalPages={siemTotalPages}
						pageJump={pageJump}
						setPageJump={setPageJump}
						copy={copy}
						onLimitChange={handleLimitChange}
						onPageChange={handlePageChange}
						onPageJumpSubmit={handlePageJumpSubmit}
					/>
				)}
			</section>
		</div>
	);
});
