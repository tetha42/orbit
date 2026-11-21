'use client';

import React, { useState, useCallback } from 'react';
import { History, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { AuditRecord } from '@/lib/audit';
import { fill } from '@/lib/text';
import { useSoc } from '../../context/SocContext';
import { AUDIT_I18N } from './audit/i18nAudit';
import { useSocAudit } from './audit/useSocAudit';
import { AuditHeader } from './audit/AuditHeader';
import { AuditFilterBar } from './audit/AuditFilterBar';
import { AuditDesktopTable } from './audit/AuditDesktopTable';
import { AuditMobileCards } from './audit/AuditMobileCards';
import { SocAuditDetailSheet } from './audit/SocAuditDetailSheet';
import s from './SocAuditView.module.css';

export function SocAuditView() {
	const { t, language } = useI18n();
	const copy = AUDIT_I18N[language] ?? AUDIT_I18N.en;
	const { canManage, setSiemIp, setSiemIpOp, setActiveTab } = useSoc();
	const audit = useSocAudit(copy, t);
	const [inspectRecord, setInspectRecord] = useState<AuditRecord | null>(null);

	const handlePivotToSiem = useCallback(
		(ip: string) => {
			setSiemIp(ip);
			setSiemIpOp?.('eq');
			setActiveTab('siem');
			setInspectRecord(null);
		},
		[setSiemIp, setSiemIpOp, setActiveTab]
	);

	return (
		<div className={s.auditContainer}>
			<section className={s.card}>
				<AuditHeader
					copy={copy}
					t={t}
					totalRecords={audit.totalRecords}
					isLoading={audit.isLoading}
					exporting={audit.exporting}
					clearing={audit.clearing}
					canManage={canManage}
					onRefresh={() => void audit.refetch()}
					onExportCsv={audit.exportAuditCsv}
					onPurgeLog={audit.purgeAuditLog}
				/>

				<AuditFilterBar
					copy={copy}
					t={t}
					searchQuery={audit.searchQuery}
					onSearchChange={audit.handleSearchChange}
					onClearSearch={audit.clearSearch}
					activeCategory={audit.activeCategory}
					onCategoryChange={audit.handleCategoryChange}
					roles={audit.roles}
					selectedRole={audit.selectedRole}
					onRoleChange={(val) => {
						audit.setSelectedRole(val);
						audit.setCurrentPage(1);
					}}
					availableActions={audit.availableActions}
					selectedAction={audit.selectedAction}
					onActionChange={(val) => {
						audit.setSelectedAction(val);
						audit.setCurrentPage(1);
					}}
					datePreset={audit.datePreset}
					onDatePreset={audit.handleDatePreset}
					fromDate={audit.fromDate}
					toDate={audit.toDate}
					onFromDateChange={(val) => {
						audit.setFromDate(val);
						audit.setDatePreset('custom');
						audit.setCurrentPage(1);
					}}
					onToDateChange={(val) => {
						audit.setToDate(val);
						audit.setDatePreset('custom');
						audit.setCurrentPage(1);
					}}
					hasActiveFilters={audit.hasActiveFilters}
					onResetFilters={audit.resetAllFilters}
				/>

				{audit.error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{t('auditError')}</div>}

				{audit.filteredRecords.length === 0 ? (
					<div className={s.emptyState}>
						<History size={32} style={{ opacity: 0.3 }} />
						<span>{audit.data ? t('auditNoRecords') : t('auditLoading')}</span>
					</div>
				) : (
					<>
						<AuditDesktopTable records={audit.filteredRecords} copy={copy} t={t} onInspect={setInspectRecord} />
						<AuditMobileCards records={audit.filteredRecords} copy={copy} t={t} onInspect={setInspectRecord} />
					</>
				)}

				{audit.totalPages > 1 && (
					<div className={s.paginationBar}>
						<span className={s.pageInfo}>
							{fill(t('auditPage'), { current: audit.currentPage, total: audit.totalPages })}
						</span>
						<div className={s.pagerBtns}>
							<button
								type="button"
								className={s.pagerBtn}
								disabled={audit.currentPage <= 1}
								onClick={() => audit.setCurrentPage((p) => p - 1)}
								title={t('previous')}
							>
								<ChevronLeft size={14} />
							</button>
							<button
								type="button"
								className={s.pagerBtn}
								disabled={audit.currentPage >= audit.totalPages}
								onClick={() => audit.setCurrentPage((p) => p + 1)}
								title={t('next')}
							>
								<ChevronRight size={14} />
							</button>
						</div>
					</div>
				)}
			</section>

			{inspectRecord && (
				<SocAuditDetailSheet
					record={inspectRecord}
					onClose={() => setInspectRecord(null)}
					onPivotToSiem={handlePivotToSiem}
				/>
			)}
		</div>
	);
}
