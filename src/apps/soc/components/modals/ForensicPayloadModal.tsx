'use client';

import React from 'react';
import {
	FileSearch,
	X,
	Copy,
	CheckCheck,
	Ban,
	CheckCircle2,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { formatDateTime } from '../../types';
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
		language,
		isEn,
	} = useSoc();

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
				{/* Header */}
				<div className={s.modalHeader}>
					<div className={s.modalHeaderTitle}>
						<FileSearch size={16} />
						<span>
							{isEn
								? `Forensic Event Inspector #${forensicLog.id}`
								: `Adli AppEvent & Payload İnceleme #${forensicLog.id}`}
						</span>
					</div>
					<button
						type="button"
						className={s.closeBtn}
						onClick={() => setForensicLog(null)}
					>
						<X size={14} />
					</button>
				</div>

				{/* Body */}
				<div className={s.modalBody}>
					{/* Metadata Grid */}
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
							gap: 8,
							padding: 10,
							borderRadius: 8,
							background: 'var(--fill-soft, rgba(0, 0, 0, 0.03))',
							border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
							fontSize: 12,
						}}
					>
						<div>
							<div style={{ fontSize: 10.5, color: 'var(--text-secondary, #6e6e73)', fontWeight: 600 }}>
								{isEn ? 'Timestamp' : 'Kayıt Zamanı'}
							</div>
							<span
								data-type="timestamp"
								onDoubleClick={handleSelectDataOnDoubleClick}
								style={{ fontFamily: 'monospace', fontWeight: 600, userSelect: 'text' }}
								title={isEn ? 'Double-click to select timestamp' : 'Zaman damgasını seçmek için çift tıklayın'}
							>
								{formatDateTime(forensicLog.zaman, language)}
							</span>
						</div>

						<div>
							<div style={{ fontSize: 10.5, color: 'var(--text-secondary, #6e6e73)', fontWeight: 600 }}>
								{isEn ? 'Service / Level' : 'Servis / Seviye'}
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
								<span
									data-type="level"
									onDoubleClick={handleSelectDataOnDoubleClick}
									style={{
										padding: '1px 6px',
										borderRadius: 4,
										fontWeight: 700,
										fontSize: 10.5,
										background:
											forensicLog.seviye === 'CRITICAL' || forensicLog.seviye === 'ERROR'
												? 'color-mix(in srgb, var(--danger, #d70015) 15%, transparent)'
												: 'color-mix(in srgb, var(--warning, #c45500) 15%, transparent)',
										color:
											forensicLog.seviye === 'CRITICAL' || forensicLog.seviye === 'ERROR'
												? 'var(--danger, #d70015)'
												: 'var(--warning, #c45500)',
										userSelect: 'text',
									}}
								>
									{forensicLog.seviye}
								</span>
								<span
									data-type="service"
									onDoubleClick={handleSelectDataOnDoubleClick}
									style={{
										fontFamily: 'monospace',
										padding: '1px 5px',
										borderRadius: 4,
										background: 'var(--fill-soft, rgba(0, 0, 0, 0.05))',
										fontSize: 11,
										userSelect: 'text',
									}}
								>
									{forensicLog.servis}
								</span>
							</div>
						</div>

						<div>
							<div style={{ fontSize: 10.5, color: 'var(--text-secondary, #6e6e73)', fontWeight: 600 }}>
								{isEn ? 'Client IP' : 'İstemci IP'}
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
								<span
									data-type="ip"
									onDoubleClick={handleSelectDataOnDoubleClick}
									style={{ fontFamily: 'monospace', fontWeight: 600, userSelect: 'text' }}
									title={isEn ? 'Double-click to select IP' : 'IP adresini seçmek için çift tıklayın'}
								>
									{forensicLog.ip || '—'}
								</span>
								{forensicLog.ip && forensicLog.ip !== 'unknown' && (
									<button
										type="button"
										onClick={() => {
											const ipVal = forensicLog.ip;
											setForensicLog(null);
											handlePivotFilter('ip', ipVal, 'eq');
										}}
										style={{
											border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
											background: 'transparent',
											borderRadius: 3,
											fontSize: 10,
											padding: '1px 4px',
											cursor: 'pointer',
											color: 'var(--accent, #0071e3)',
										}}
										title={isEn ? 'Filter by this IP' : 'Bu IP ile süz'}
									>
										{isEn ? '+ Filter' : '+ Süz'}
									</button>
								)}
							</div>
						</div>

						<div>
							<div style={{ fontSize: 10.5, color: 'var(--text-secondary, #6e6e73)', fontWeight: 600 }}>
								{isEn ? 'Actor' : 'Aktör / Kullanıcı'}
							</div>
							<span
								data-type="actor"
								onDoubleClick={handleSelectDataOnDoubleClick}
								style={{ fontFamily: 'monospace', userSelect: 'text' }}
							>
								{forensicLog.userId || 'anonymous'}
							</span>
						</div>
					</div>

					{/* Event Message */}
					<div className={s.formField}>
						<label>{isEn ? 'Security Event Message' : 'Güvenlik AppEventı Mesajı'}</label>
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
							title={isEn ? 'Double-click to select message' : 'Mesajı seçmek için çift tıklayın'}
						>
							{forensicLog.mesaj}
						</div>
					</div>

					{/* Forensic JSON Payload */}
					<div className={s.formField}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<label>{isEn ? 'Forensic Raw Payload (JSON)' : 'Adli Ham İstek Detayı (JSON Payload)'}</label>
							<button
								type="button"
								className={s.btn}
								onClick={handleCopyForensic}
								style={{ height: 24, padding: '0 8px', fontSize: 11 }}
							>
								{forensicCopied ? <CheckCheck size={11} color="var(--success, #248a3d)" /> : <Copy size={11} />}
								<span>{forensicCopied ? (isEn ? 'Copied' : 'Kopyalandı') : (isEn ? 'Copy JSON' : 'Kopyala')}</span>
							</button>
						</div>
						<pre className={s.codeBlock}>
							{JSON.stringify(forensicLog.detay || {}, null, 2)}
						</pre>
					</div>

					{/* Quick Pivots */}
					{forensicLog.detay && typeof forensicLog.detay === 'object' && Object.keys(forensicLog.detay).length > 0 && (
						<div className={s.formField}>
							<label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
								{isEn ? 'Quick Pivot Filters' : 'Hızlı Pivot Filtreler'}
							</label>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
								{Object.entries(forensicLog.detay).map(([k, v]) => {
									const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
									if (!valStr || valStr.length > 50) return null;
									return (
										<span
											key={k}
											style={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: 4,
												padding: '3px 7px',
												borderRadius: 5,
												background: 'var(--fill-soft, rgba(0, 0, 0, 0.04))',
												border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
												fontSize: 11,
											}}
										>
											<span>{k}: <strong>{valStr}</strong></span>
											<button
												type="button"
												onClick={() => {
													setForensicLog(null);
													handlePivotFilter(k, valStr, 'eq');
												}}
												style={{
													border: 'none',
													background: 'transparent',
													color: 'var(--accent, #0071e3)',
													cursor: 'pointer',
													fontSize: 10,
													fontWeight: 600,
													padding: '0 2px',
												}}
												title={isEn ? `Filter by ${k}=${valStr}` : `Bu değere göre filtrele`}
											>
												{isEn ? '+ Filter' : '+ Süz'}
											</button>
											<button
												type="button"
												onClick={() => {
													setForensicLog(null);
													handlePivotFilter(k, valStr, 'neq');
												}}
												style={{
													border: 'none',
													background: 'transparent',
													color: 'var(--danger, #d70015)',
													cursor: 'pointer',
													fontSize: 10,
													fontWeight: 600,
													padding: '0 2px',
												}}
												title={isEn ? `Exclude ${k}=${valStr}` : `Bu değeri dışla`}
											>
												{isEn ? '≠ Exclude' : '≠ Dışla'}
											</button>
										</span>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
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
										isEn
											? `Forensic Inspection: ${forensicLog.mesaj.slice(0, 80)}`
											: `Adli Müfettiş İncelemesi: ${forensicLog.mesaj.slice(0, 80)}`
									);
								}}
							>
								<Ban size={12} />
								<span>{isEn ? `Quarantine ${forensicLog.ip}` : `${forensicLog.ip} Karantinaya Al`}</span>
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
											neden: isEn
												? 'Marked as trusted during forensic inspection'
												: 'Adli İncelemede Güvenilir Olarak İşaretlendi',
										},
										isEn
											? `${ipToWhitelist} added to whitelist.`
											: `${ipToWhitelist} güvenilir listeye alındı.`
									);
								}}
							>
								<CheckCircle2 size={12} />
								<span>{isEn ? 'Whitelist IP' : 'Whitelist Ekle'}</span>
							</button>
						</>
					)}

					<button
						type="button"
						className={s.btn}
						onClick={() => setForensicLog(null)}
					>
						{isEn ? 'Close' : 'Kapat'}
					</button>
				</div>
			</div>
		</div>
	);
});
