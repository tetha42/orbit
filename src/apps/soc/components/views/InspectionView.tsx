'use client';

import React, { useMemo } from 'react';
import { ShieldCheck, HardDrive, AlertCircle, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSoc } from '../../context/SocContext';
import { FimDiffModal } from '../modals/FimDiffModal';
import { INSPECTION_I18N } from './inspection/i18nInspection';
import { ApiSecurityPanel } from './inspection/ApiSecurityPanel';
import { FimScannerPanel } from './inspection/FimScannerPanel';
import s from '../../Soc.module.css';
import ins from '../../SocInspection.module.css';

export const InspectionView = React.memo(function InspectionView() {
	const [diffModalFile, setDiffModalFile] = React.useState<string | null>(null);
	const {
		inspectionSubTab,
		setInspectionSubTab,
		inspectionError,
		setInspectionError,
		appSecResult,
		fimResult,
		inspectionLoading,
		reportLoading,
		handleDownloadAuditReport,
		handleTriggerApiScan,
		handleTriggerFimScan,
		handleCreateBaseline,
		handleProbeSingleRoute,
		probingEndpoint,
		apiFilterCategory,
		setApiFilterCategory,
		apiSearch,
		setApiSearch,
		fimTarget,
		handleTargetChange,
		canManage,
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
		openInspector,
	} = useSoc();
	const { language } = useI18n();
	const copy = INSPECTION_I18N[language] ?? INSPECTION_I18N.en;

	const filteredRoutes = useMemo(() => {
		const search = apiSearch.trim().toLowerCase();
		return (appSecResult?.routes ?? []).filter((r) => {
			if (apiFilterCategory !== 'all' && r.category !== apiFilterCategory) return false;
			if (search && !r.endpoint.toLowerCase().includes(search)) return false;
			return true;
		});
	}, [appSecResult?.routes, apiFilterCategory, apiSearch]);

	return (
		<div className={s.viewContainer}>
			<section className={s.card}>
				<div className={ins.subTabBar}>
					<button
						type="button"
						className={`${ins.subTabBtn} ${inspectionSubTab === 'api' ? ins.subTabBtnActive : ''}`}
						onClick={() => {
							setInspectionError(null);
							setInspectionSubTab('api');
						}}
					>
						<ShieldCheck size={14} />
						<span>{copy.tabApi}</span>
						{appSecResult && (
							<span className={ins.subTabBadge}>
								{appSecResult.passed}/{appSecResult.totalTested}
							</span>
						)}
					</button>

					<button
						type="button"
						className={`${ins.subTabBtn} ${inspectionSubTab === 'fim' ? ins.subTabBtnActive : ''}`}
						onClick={() => {
							setInspectionError(null);
							setInspectionSubTab('fim');
						}}
					>
						<HardDrive size={14} />
						<span>{copy.tabFim}</span>
						{fimResult && (
							<span className={ins.subTabBadge}>
								{fimResult.scannedFiles} {copy.filesUnit}
							</span>
						)}
					</button>
				</div>

				{inspectionError && (
					<div className={ins.errorCard} style={{ margin: 16 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<AlertCircle size={16} />
							<span>{inspectionError}</span>
						</div>
						<button
							type="button"
							className={s.actionBtn}
							onClick={() => setInspectionError(null)}
							style={{ padding: '2px 8px' }}
						>
							<X size={12} />
						</button>
					</div>
				)}

				<div style={{ padding: 16 }}>
					{inspectionSubTab === 'api' && (
						<ApiSecurityPanel
							appSecResult={appSecResult}
							filteredRoutes={filteredRoutes}
							apiFilterCategory={apiFilterCategory}
							setApiFilterCategory={setApiFilterCategory}
							apiSearch={apiSearch}
							setApiSearch={setApiSearch}
							reportLoading={reportLoading}
							inspectionLoading={inspectionLoading}
							probingEndpoint={probingEndpoint}
							copy={copy}
							onDownloadReport={handleDownloadAuditReport}
							onTriggerApiScan={handleTriggerApiScan}
							onProbeRoute={handleProbeSingleRoute}
							onContainerDoubleClick={handleDataContainerDoubleClick}
							onSelectData={handleSelectDataOnDoubleClick}
						/>
					)}

					{inspectionSubTab === 'fim' && (
						<FimScannerPanel
							fimResult={fimResult}
							fimTarget={fimTarget}
							inspectionLoading={inspectionLoading}
							canManage={canManage}
							copy={copy}
							onTargetChange={handleTargetChange}
							onTriggerFimScan={handleTriggerFimScan}
							onCreateBaseline={handleCreateBaseline}
							onOpenInspector={openInspector}
							onContainerDoubleClick={handleDataContainerDoubleClick}
							onSelectData={handleSelectDataOnDoubleClick}
							onOpenDiffModal={setDiffModalFile}
						/>
					)}
				</div>
			</section>

			{diffModalFile && (
				<FimDiffModal filePath={diffModalFile} onClose={() => setDiffModalFile(null)} />
			)}
		</div>
	);
});
