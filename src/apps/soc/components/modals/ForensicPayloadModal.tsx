'use client';

import React from 'react';
import { FileSearch, X, Copy, CheckCheck, Ban, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useSoc } from '../../context/SocContext';
import { MODALS_I18N } from './i18nModals';
import { ForensicMetaGrid } from './forensic/ForensicMetaGrid';
import { ForensicQuickPivots } from './forensic/ForensicQuickPivots';
import s from './SocModals.module.css';

export const ForensicPayloadModal = React.memo(function ForensicPayloadModal() {
	const {
		forensicLog,
		setForensicLog,
		forensicCopied,
		handleCopyForensic,
		handleSelectDataOnDoubleClick,
		handlePivotFilter,
		canManage,
		callerIp,
		handleQuickBan,
		runSocAction,
	} = useSoc();
	const { language } = useI18n();
	const copy = MODALS_I18N[language] ?? MODALS_I18N.en;

	if (!forensicLog) return null;

	const canBanLogIp =
		canManage &&
		forensicLog.ip &&
		forensicLog.ip !== 'unknown' &&
		forensicLog.ip !== '127.0.0.1' &&
		forensicLog.ip !== callerIp;

	return (
		<div className={s.backdrop} onClick={() => setForensicLog(null)}>
			<div className={s.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
				<div className={s.modalHeader}>
					<div className={s.modalHeaderTitle}>
						<FileSearch size={16} />
						<span>{fill(copy.forensicTitle, { id: forensicLog.id })}</span>
					</div>
					<button type="button" className={s.closeBtn} onClick={() => setForensicLog(null)}>
						<X size={14} />
					</button>
				</div>

				<div className={s.modalBody}>
					<ForensicMetaGrid
						forensicLog={forensicLog}
						language={language}
						copy={copy}
						onDoubleClickSelect={handleSelectDataOnDoubleClick}
						onFilterIp={(ipVal) => {
							setForensicLog(null);
							handlePivotFilter('ip', ipVal, 'eq');
						}}
					/>

					<div className={s.formField}>
						<label>{copy.forensicMessageLabel}</label>
						<div
							data-type="message"
							onDoubleClick={handleSelectDataOnDoubleClick}
							style={{
								fontSize: 13,
								fontWeight: 600,
								color: 'var(--text-primary)',
								userSelect: 'text',
								padding: '6px 10px',
								borderRadius: 6,
								background: 'var(--fill-soft, rgba(0, 0, 0, 0.03))',
							}}
							title={copy.forensicMessageHint}
						>
							{forensicLog.message}
						</div>
					</div>

					<div className={s.formField}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<label>{copy.forensicPayloadLabel}</label>
							<button
								type="button"
								className={s.btn}
								onClick={handleCopyForensic}
								style={{ height: 24, padding: '0 8px', fontSize: 11 }}
							>
								{forensicCopied ? <CheckCheck size={11} color="var(--success)" /> : <Copy size={11} />}
								<span>{forensicCopied ? copy.fimDiffCopied : copy.forensicCopyJson}</span>
							</button>
						</div>
						<pre className={s.codeBlock}>
							{JSON.stringify(forensicLog.detail || {}, null, 2)}
						</pre>
					</div>

					{forensicLog.detail && typeof forensicLog.detail === 'object' && (
						<ForensicQuickPivots
							detail={forensicLog.detail}
							copy={copy}
							onPivot={(k, valStr, op) => {
								setForensicLog(null);
								handlePivotFilter(k, valStr, op);
							}}
						/>
					)}
				</div>

				<div className={s.modalFooter}>
					{canBanLogIp && (
						<>
							<button
								type="button"
								className={`${s.btn} ${s.btnDanger}`}
								onClick={() => {
									const ipToBan = forensicLog.ip;
									setForensicLog(null);
									void handleQuickBan(
										ipToBan,
										fill(copy.forensicBanReason, { msg: forensicLog.message.slice(0, 80) })
									);
								}}
							>
								<Ban size={12} />
								<span>{fill(copy.forensicQuarantineBtn, { ip: forensicLog.ip })}</span>
							</button>

							<button
								type="button"
								className={s.btn}
								onClick={() => {
									const ipToWhitelist = forensicLog.ip;
									setForensicLog(null);
									void runSocAction(
										{
											action: 'whitelist_ip',
											ip: ipToWhitelist,
											reason: copy.forensicWhitelistReason,
										},
										fill(copy.forensicWhitelistSuccess, { ip: ipToWhitelist })
									);
								}}
							>
								<CheckCircle2 size={12} />
								<span>{copy.forensicWhitelistBtn}</span>
							</button>
						</>
					)}

					<button type="button" className={s.btn} onClick={() => setForensicLog(null)}>
						{copy.forensicClose}
					</button>
				</div>
			</div>
		</div>
	);
});
