'use client';

import React from 'react';
import {
	FileSearch,
	Activity,
	Download,
	Radio,
	Clock,
	Calendar,
	RotateCcw,
	Filter,
	Server,
	AlertTriangle,
	Globe,
	X,
	Eye,
	ChevronDown,
	ChevronUp,
	ChevronsLeft,
	ChevronLeft,
	ChevronRight,
	ChevronsRight,
	Ban,
	ShieldAlert,
	ShieldCheck,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { formatDateTime } from '../../types';
import type { TimeRangePreset, SiemAramaOp, SiemAramaAlani } from '../../types';
import { formatSocAlertMessage } from '../../utils/alertLocalization';
import s from '../../Soc.module.css';

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
		siemAramaAlani,
		setSiemAramaAlani,
		siemAramaOp,
		setSiemAramaOp,
		siemArama,
		setSiemArama,
		fetchSiemFiltered,
		siemServis,
		setSiemServis,
		siemServisOp,
		setSiemServisOp,
		siemSeviye,
		setSiemSeviye,
		siemSeviyeOp,
		setSiemSeviyeOp,
		siemIp,
		setSiemIp,
		siemIpOp,
		setSiemIpOp,
		handleQuickExcludeSeviye,
		handleQuickExcludeServis,
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
		language,
		isEn,
	} = useSoc();

	return (
		<div className={s.viewContainer}>
			<section className={s.card}>
				{/* Card Header */}
				<div className={s.cardHeader}>
					<div>
						<h2 className={s.cardTitle}>
							<FileSearch size={16} />
							<span>{isEn ? 'SIEM Forensic Log Analyzer' : 'SIEM & Adli Güvenlik Kayıt Analizi'}</span>
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Immutable security, authentication, terminal PTY, and database query logs'
								: 'Değiştirilemez (Zero-Trust korumalı) güvenlik, kimlik doğrulama, terminal PTY ve veritabanı logları'}
						</p>
					</div>

					<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
						<span className={s.siemCountBadge}>
							<Activity size={12} />
							<span>{isEn ? `${siemLogs.length} Events` : `${siemLogs.length} AppEvent`}</span>
						</span>

						<div className={s.segmentedBtnGroup}>
							<button
								type="button"
								onClick={() => handleExportSiem('csv')}
								className={s.segmentedBtn}
								title={isEn ? 'Export forensic logs as CSV' : 'Adli logları CSV olarak indir'}
							>
								<Download size={12} />
								CSV
							</button>
							<button
								type="button"
								onClick={() => handleExportSiem('json')}
								className={s.segmentedBtn}
								title={isEn ? 'Export forensic logs as JSON' : 'Adli logları JSON olarak indir'}
							>
								JSON
							</button>
						</div>

						<button
							type="button"
							onClick={() => setLiveTail((v) => !v)}
							className={`${s.actionBtn} ${liveTail ? s.actionBtnSuccess : ''}`}
							style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
							title={isEn ? 'Toggle real-time SSE live tail log streaming' : 'Canlı SSE log akışını aç/kapat'}
						>
							{liveTail ? (
								<>
									<span className={s.pulseDot} />
									<span>{isEn ? 'Live Tail (Active)' : 'Canlı Akış (Aktif)'}</span>
								</>
							) : (
								<>
									<Radio size={13} />
									<span>{isEn ? 'Live Tail (SSE)' : 'Canlı Akış (SSE)'}</span>
								</>
							)}
						</button>
					</div>
				</div>

				{/* Time Window Bar */}
				<div className={s.siemTimeRangeBar}>
					<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>
						<Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
						{isEn ? 'Time Window:' : 'Zaman Aralığı:'}
					</span>
					{(['15m', '1h', '6h', '24h', '7d', 'all'] as TimeRangePreset[]).map((preset) => {
						const labels: Record<string, { en: string; tr: string }> = {
							'15m': { en: 'Last 15m', tr: 'Son 15 Dk' },
							'1h': { en: 'Last 1h', tr: 'Son 1 Saat' },
							'6h': { en: 'Last 6h', tr: 'Son 6 Saat' },
							'24h': { en: 'Last 24h', tr: 'Son 24 Saat' },
							'7d': { en: 'Last 7d', tr: 'Son 7 Gün' },
							all: { en: 'All Time', tr: 'Tüm Zamanlar' },
						};
						const isActive = siemTimeRange === preset && !siemStartTime;
						return (
							<button
								key={preset}
								type="button"
								className={`${s.siemTimeRangeBtn} ${isActive ? s.siemTimeRangeBtnActive : ''}`}
								onClick={() => handleSelectTimeRange(preset)}
							>
								{isEn ? labels[preset].en : labels[preset].tr}
							</button>
						);
					})}

					<button
						type="button"
						className={`${s.siemTimeRangeBtn} ${siemTimeRange === 'custom' ? s.siemTimeRangeBtnActive : ''}`}
						onClick={() => setShowCustomDateModal(true)}
						title={isEn ? 'Custom Start / End DateTime' : 'Özel Başlangıç / Bitiş Zamanı'}
					>
						<Calendar size={12} />
						<span>
							{siemStartTime && siemEndTime
								? `${formatDateTime(siemStartTime, language)} – ${formatDateTime(siemEndTime, language)}`
								: isEn
								? 'Custom Range...'
								: 'Özel Aralık...'}
						</span>
					</button>

					{selectedBucket && (
						<button
							type="button"
							className={`${s.siemTimeRangeBtn} ${s.siemTimeRangeBtnActive}`}
							onClick={() => handleSelectTimeRange('24h')}
							title={isEn ? 'Clear bucket zoom' : 'Aralık yakınlaştırmasını sıfırla'}
							style={{ background: 'var(--warning, #c45500)', color: '#ffffff' }}
						>
							<RotateCcw size={11} />
							<span>{isEn ? 'Reset Zoom' : 'Zoom Sıfırla'}</span>
						</button>
					)}
				</div>

				{/* Histogram */}
				{siemHistogram.length > 0 && (
					<div className={s.siemHistogramCard}>
						<div className={s.siemHistogramHeader}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
								<Activity size={13} color="var(--accent, #0071e3)" />
								<span style={{ fontWeight: 600 }}>
									{isEn ? 'Timeline Distribution & Anomaly Spikes' : 'Zaman Çizelgesi Dağılımı & Tehdit Pikleri'}
								</span>
								<span style={{ opacity: 0.6, fontSize: 11 }}>
									({siemHistogram.length} {isEn ? 'buckets' : 'dilim'})
								</span>
							</div>

							<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
									<span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--danger, #d70015)' }} />
									CRITICAL
								</span>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
									<span style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316' }} />
									ERROR
								</span>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
									<span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--warning, #c45500)' }} />
									WARN
								</span>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
									<span style={{ width: 8, height: 8, borderRadius: 2, background: '#38bdf8' }} />
									INFO
								</span>
							</div>
						</div>

						<div className={s.siemHistogramBars}>
							{(() => {
								const maxCount = Math.max(1, ...siemHistogram.map((b) => b.count));
								return siemHistogram.map((b, idx) => {
									const isSelected = selectedBucket === b.start;
									const totalHeightPct = Math.max(6, Math.round((b.count / maxCount) * 100));
									const critPct = b.count > 0 ? (b.critical / b.count) * 100 : 0;
									const errPct = b.count > 0 ? (b.error / b.count) * 100 : 0;
									const warnPct = b.count > 0 ? (b.warn / b.count) * 100 : 0;
									const infoPct = b.count > 0 ? (b.info / b.count) * 100 : 0;

									return (
										<div
											key={idx}
											className={`${s.siemHistogramCol} ${isSelected ? s.siemHistogramColActive : ''}`}
											onClick={() => handleZoomBucket(b)}
											title={`${formatDateTime(b.start, language)}: ${b.count} ${
												isEn ? 'events' : 'kayıt'
											} (${b.critical} crit, ${b.error} err, ${b.warn} warn, ${b.info} info)`}
										>
											<div className={s.siemHistogramBar} style={{ height: `${totalHeightPct}%` }}>
												{critPct > 0 && (
													<div className={s.siemHistogramSegCritical} style={{ height: `${critPct}%` }} />
												)}
												{errPct > 0 && (
													<div className={s.siemHistogramSegError} style={{ height: `${errPct}%` }} />
												)}
												{warnPct > 0 && (
													<div className={s.siemHistogramSegWarn} style={{ height: `${warnPct}%` }} />
												)}
												{infoPct > 0 && (
													<div className={s.siemHistogramSegInfo} style={{ height: `${infoPct}%` }} />
												)}
											</div>
											{idx % Math.max(1, Math.floor(siemHistogram.length / 6)) === 0 && (
												<span className={s.siemHistogramColLabel}>
													{new Date(b.start).toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
														hour: '2-digit',
														minute: '2-digit',
													})}
												</span>
											)}
										</div>
									);
								});
							})()}
						</div>
					</div>
				)}

				{/* Filter Console */}
				<div className={s.siemConsole}>
					<div className={s.siemOmnibar}>
						<div className={s.siemOmnibarScope} title={isEn ? 'Search Column Scope' : 'Arama Kapsamı'}>
							<Filter size={12} style={{ color: 'var(--text-secondary)' }} />
							<select
								className={s.siemScopeSelect}
								value={siemAramaAlani}
								onChange={(e) => {
									const next = e.target.value as SiemAramaAlani;
									setSiemAramaAlani(next);
									if (siemArama.trim()) void fetchSiemFiltered({ aramaAlani: next });
								}}
							>
								<option value="all">{isEn ? 'All Columns' : 'Tüm Alanlar'}</option>
								<option value="mesaj">{isEn ? 'Message' : 'Mesaj'}</option>
								<option value="ip">IP</option>
								<option value="servis">{isEn ? 'Service' : 'Servis'}</option>
								<option value="userId">{isEn ? 'Actor' : 'Aktör'}</option>
								<option value="detay">{isEn ? 'JSON Detail' : 'JSON Detay'}</option>
							</select>
						</div>

						<div className={s.siemOmnibarScope} title={isEn ? 'Matching Condition' : 'Arama Koşulu'}>
							<select
								className={s.siemScopeSelect}
								value={siemAramaOp}
								onChange={(e) => {
									const next = e.target.value as SiemAramaOp;
									setSiemAramaOp(next);
									if (siemArama.trim()) void fetchSiemFiltered({ aramaOp: next });
								}}
							>
								<option value="contains">{isEn ? 'Contains' : 'İçerir'}</option>
								<option value="not_contains">{isEn ? 'Does Not Contain' : 'İçermez'}</option>
								<option value="equals">{isEn ? 'Equals (=)' : 'Eşittir (=)'}</option>
								<option value="not_equals">{isEn ? 'Not Equal (≠)' : 'Eşit Değil (≠)'}</option>
								<option value="starts_with">{isEn ? 'Starts With' : 'İle Başlar'}</option>
								<option value="ends_with">{isEn ? 'Ends With' : 'İle Biter'}</option>
							</select>
						</div>

						<div className={s.siemInputWrap}>
							<input
								type="text"
								className={s.siemSearchInput}
								placeholder={
									isEn
										? 'Query terms, status codes, IPs... (prefix - or ! to exclude, e.g. -127.0.0.1)'
										: 'Sorgu, status kodu, IP... (hariç tutmak için - veya ! kullanın, örn: -127.0.0.1)'
								}
								value={siemArama}
								onChange={(e) => setSiemArama(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') void fetchSiemFiltered();
								}}
							/>
							{siemArama && (
								<button
									type="button"
									className={s.siemOmnibarClear}
									onClick={() => {
										setSiemArama('');
										void fetchSiemFiltered({ arama: '' });
									}}
									title={isEn ? 'Clear search' : 'Aramayı temizle'}
								>
									<X size={13} />
								</button>
							)}
						</div>

						<button
							type="button"
							className={s.siemSubmitBtn}
							onClick={() => void fetchSiemFiltered()}
							disabled={isLoading}
						>
							<FileSearch size={13} />
							<span>{isEn ? 'Filter' : 'Filtrele'}</span>
						</button>
					</div>

					{/* KQL Quick Syntax Chips */}
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '4px 0 10px', fontSize: 11 }}>
						<span style={{ color: 'var(--text-tertiary, #8e8e93)', fontWeight: 600, fontSize: 10 }}>KQL:</span>
						{[
							{ label: 'service:auth', val: 'service:auth ' },
							{ label: 'level:WARN', val: 'level:WARN ' },
							{ label: 'level:CRITICAL', val: 'level:CRITICAL ' },
							{ label: 'ip:!127.0.0.1', val: 'ip:!127.0.0.1 ' },
							{ label: 'msg:failed', val: 'msg:failed ' },
						].map((pill) => (
							<button
								key={pill.label}
								type="button"
								onClick={() => {
									const next = `${siemArama ? `${siemArama.trim()} ` : ''}${pill.val}`;
									setSiemArama(next);
								}}
								style={{
									background: 'var(--fill-soft, rgba(0,0,0,0.04))',
									border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
									borderRadius: 4,
									padding: '2px 7px',
									fontSize: 10.5,
									fontFamily: 'monospace',
									cursor: 'pointer',
									color: 'var(--text-secondary, #6e6e73)',
								}}
							>
								+{pill.label}
							</button>
						))}
						{siemArama.includes(':') && (
							<span
								style={{
									fontSize: 10,
									fontWeight: 700,
									padding: '2px 6px',
									borderRadius: 4,
									background: 'rgba(0, 113, 227, 0.12)',
									color: 'var(--accent, #0071e3)',
									marginLeft: 'auto',
								}}
							>
								KQL SYNTAX ACTIVE
							</span>
						)}
					</div>

					{/* Secondary Filter Row */}
					<div className={s.siemFiltersRow}>
						{/* Servis Pill */}
						<div className={s.siemFilterPill}>
							<span className={s.siemFilterPillLabel}>
								<Server size={11} />
								{isEn ? 'Service' : 'Servis'}:
							</span>
							<button
								type="button"
								className={`${s.siemOpToggle} ${siemServisOp === 'neq' ? s.siemOpToggleActive : ''}`}
								onClick={() => {
									const nextOp = siemServisOp === 'eq' ? 'neq' : 'eq';
									setSiemServisOp(nextOp);
									if (siemServis !== 'all') void fetchSiemFiltered({ servisOp: nextOp });
								}}
								title={
									siemServisOp === 'eq'
										? isEn ? 'Click to invert (≠ Is Not)' : 'Tıkla: Dışla (≠ Değildir)'
										: isEn ? 'Currently excluding. Click to match (= Equals).' : 'Şu an dışlanıyor. Tıkla: Eşittir yap.'
								}
							>
								{siemServisOp === 'neq' ? '≠' : '='}
							</button>
							<select
								className={s.siemFilterSelect}
								value={siemServis}
								onChange={(e) => {
									const next = e.target.value;
									setSiemServis(next);
									void fetchSiemFiltered({ servis: next });
								}}
							>
								<option value="all">{isEn ? 'All Services' : 'Tüm Servisler'}</option>
								<option value="security">security (WAF / IPS / CSRF)</option>
								<option value="auth">auth (Login / 2FA / Passkey)</option>
								<option value="terminal">terminal (SSH / PTY)</option>
								<option value="database">database (SQL Studio)</option>
								<option value="chat">chat (Messaging)</option>
								<option value="oauth">oauth (OAuth2 / OIDC)</option>
								<option value="smtp">smtp (Mail Engine)</option>
							</select>
						</div>

						{/* Seviye Pill */}
						<div className={s.siemFilterPill}>
							<span className={s.siemFilterPillLabel}>
								<AlertTriangle size={11} />
								{isEn ? 'Severity' : 'Seviye'}:
							</span>
							<button
								type="button"
								className={`${s.siemOpToggle} ${siemSeviyeOp === 'neq' ? s.siemOpToggleActive : ''}`}
								onClick={() => {
									const nextOp = siemSeviyeOp === 'eq' ? 'neq' : 'eq';
									setSiemSeviyeOp(nextOp);
									if (siemSeviye !== 'all') void fetchSiemFiltered({ seviyeOp: nextOp });
								}}
							>
								{siemSeviyeOp === 'neq' ? '≠' : '='}
							</button>
							<select
								className={s.siemFilterSelect}
								value={siemSeviye}
								onChange={(e) => {
									const next = e.target.value;
									setSiemSeviye(next);
									void fetchSiemFiltered({ seviye: next });
								}}
							>
								<option value="all">{isEn ? 'All Severities' : 'Tüm Seviyeler'}</option>
								<option value="CRITICAL">CRITICAL</option>
								<option value="ERROR">ERROR</option>
								<option value="WARN">WARN</option>
								<option value="INFO">INFO</option>
							</select>
						</div>

						{/* IP Pill */}
						<div className={s.siemFilterPill}>
							<span className={s.siemFilterPillLabel}>
								<Globe size={11} />
								IP:
							</span>
							<button
								type="button"
								className={`${s.siemOpToggle} ${siemIpOp === 'neq' ? s.siemOpToggleActive : ''}`}
								onClick={() => {
									const nextOp = siemIpOp === 'eq' ? 'neq' : 'eq';
									setSiemIpOp(nextOp);
									if (siemIp.trim()) void fetchSiemFiltered({ ipOp: nextOp });
								}}
							>
								{siemIpOp === 'neq' ? '≠' : '='}
							</button>
							<input
								type="text"
								className={s.siemIpInput}
								placeholder={isEn ? 'Filter IP...' : 'IP filtrele...'}
								value={siemIp}
								onChange={(e) => setSiemIp(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') void fetchSiemFiltered();
								}}
							/>
							{siemIp && (
								<button
									type="button"
									className={s.siemOmnibarClear}
									onClick={() => {
										setSiemIp('');
										void fetchSiemFiltered({ ip: '' });
									}}
									title={isEn ? 'Clear IP' : 'IP Temizle'}
								>
									<X size={12} />
								</button>
							)}
						</div>

						{/* Smart Preset Chips - No Emojis! */}
						<div className={s.siemPresetDivider} />

						<button
							type="button"
							className={`${s.siemPresetChip} ${siemIp === '127.0.0.1' && siemIpOp === 'neq' ? s.siemPresetChipActive : ''}`}
							onClick={() => {
								if (siemIp === '127.0.0.1' && siemIpOp === 'neq') {
									setSiemIp('');
									setSiemIpOp('eq');
									void fetchSiemFiltered({ ip: '', ipOp: 'eq' });
								} else {
									setSiemIp('127.0.0.1');
									setSiemIpOp('neq');
									void fetchSiemFiltered({ ip: '127.0.0.1', ipOp: 'neq' });
								}
							}}
							title={isEn ? 'Toggle exclude localhost' : 'Localhost dışlamayı aç/kapat'}
							style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
						>
							<Ban size={11} />
							<span>{isEn ? 'Exclude Localhost' : 'Localhost Hariç'}</span>
						</button>

						<button
							type="button"
							className={`${s.siemPresetChip} ${siemSeviye === 'INFO' && siemSeviyeOp === 'neq' ? s.siemPresetChipActive : ''}`}
							onClick={() => {
								if (siemSeviye === 'INFO' && siemSeviyeOp === 'neq') {
									setSiemSeviye('all');
									setSiemSeviyeOp('eq');
									void fetchSiemFiltered({ seviye: 'all', seviyeOp: 'eq' });
								} else {
									setSiemSeviye('INFO');
									setSiemSeviyeOp('neq');
									void fetchSiemFiltered({ seviye: 'INFO', seviyeOp: 'neq' });
								}
							}}
							title={isEn ? 'Toggle exclude INFO level logs' : 'INFO seviyesini gizlemeyi aç/kapat'}
							style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
						>
							<AlertTriangle size={11} />
							<span>{isEn ? 'Exclude INFO' : 'INFO Hariç'}</span>
						</button>

						<button
							type="button"
							className={`${s.siemPresetChip} ${siemSeviye === 'CRITICAL' && siemSeviyeOp === 'eq' ? s.siemPresetChipActive : ''}`}
							onClick={() => {
								if (siemSeviye === 'CRITICAL' && siemSeviyeOp === 'eq') {
									setSiemSeviye('all');
									void fetchSiemFiltered({ seviye: 'all' });
								} else {
									setSiemSeviye('CRITICAL');
									setSiemSeviyeOp('eq');
									void fetchSiemFiltered({ seviye: 'CRITICAL', seviyeOp: 'eq' });
								}
							}}
							title={isEn ? 'Show only critical logs' : 'Yalnızca kritik logları göster'}
							style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
						>
							<ShieldAlert size={11} />
							<span>{isEn ? 'Only CRITICAL' : 'Yalnızca CRITICAL'}</span>
						</button>

						<button
							type="button"
							className={`${s.siemPresetChip} ${siemServis === 'security' && siemServisOp === 'eq' ? s.siemPresetChipActive : ''}`}
							onClick={() => {
								if (siemServis === 'security' && siemServisOp === 'eq') {
									setSiemServis('all');
									void fetchSiemFiltered({ servis: 'all' });
								} else {
									setSiemServis('security');
									setSiemServisOp('eq');
									void fetchSiemFiltered({ servis: 'security', servisOp: 'eq' });
								}
							}}
							title={isEn ? 'Show only security & WAF logs' : 'Yalnızca güvenlik ve WAF loglarını göster'}
							style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
						>
							<ShieldCheck size={11} />
							<span>{isEn ? 'Security / WAF' : 'Güvenlik / WAF'}</span>
						</button>

						{(siemServis !== 'all' || siemSeviye !== 'all' || siemIp.trim() || siemArama.trim()) && (
							<button
								type="button"
								className={s.siemResetBtn}
								onClick={handleResetAllFilters}
								title={isEn ? 'Reset all active filters' : 'Tüm filtreleri sıfırla'}
							>
								<RotateCcw size={12} />
								<span>{isEn ? 'Reset' : 'Sıfırla'}</span>
							</button>
						)}
					</div>

					{/* Active Filter Badges */}
					{(siemServis !== 'all' || siemSeviye !== 'all' || siemIp.trim() || siemArama.trim() || siemTimeRange !== '24h' || siemStartTime !== null) && (
						<div className={s.excelChipsBar}>
							<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
								{isEn ? 'Active Filters:' : 'Uygulanan Filtreler:'}
							</span>

							{(siemTimeRange !== '24h' || siemStartTime !== null) && (
								<span className={s.excelChip}>
									<Clock size={11} />
									{isEn ? 'Window:' : 'Pencere:'} {siemTimeRange}
									{siemStartTime ? ` (${formatDateTime(siemStartTime, language)})` : ''}
									<button
										type="button"
										className={s.excelChipClose}
										onClick={() => handleSelectTimeRange('24h')}
										title={isEn ? 'Reset to 24h' : '24 saate dön'}
									>
										<X size={12} />
									</button>
								</span>
							)}

							{siemServis !== 'all' && (
								<span className={`${s.excelChip} ${siemServisOp === 'neq' ? s.excelChipNeg : ''}`}>
									{isEn ? 'Service' : 'Servis'} {siemServisOp === 'neq' ? '≠' : '='} {siemServis}
									<button
										type="button"
										className={s.excelChipClose}
										onClick={() => {
											setSiemServis('all');
											setSiemServisOp('eq');
											void fetchSiemFiltered({ servis: 'all', servisOp: 'eq' });
										}}
									>
										<X size={12} />
									</button>
								</span>
							)}

							{siemSeviye !== 'all' && (
								<span className={`${s.excelChip} ${siemSeviyeOp === 'neq' ? s.excelChipNeg : ''}`}>
									{isEn ? 'Level' : 'Seviye'} {siemSeviyeOp === 'neq' ? '≠' : '='} {siemSeviye}
									<button
										type="button"
										className={s.excelChipClose}
										onClick={() => {
											setSiemSeviye('all');
											setSiemSeviyeOp('eq');
											void fetchSiemFiltered({ seviye: 'all', seviyeOp: 'eq' });
										}}
									>
										<X size={12} />
									</button>
								</span>
							)}

							{siemIp.trim() && (
								<span className={`${s.excelChip} ${siemIpOp === 'neq' ? s.excelChipNeg : ''}`}>
									IP {siemIpOp === 'neq' ? '≠' : '='} {siemIp}
									<button
										type="button"
										className={s.excelChipClose}
										onClick={() => {
											setSiemIp('');
											setSiemIpOp('eq');
											void fetchSiemFiltered({ ip: '', ipOp: 'eq' });
										}}
									>
										<X size={12} />
									</button>
								</span>
							)}

							{siemArama.trim() && (
								<span
									className={`${s.excelChip} ${
										siemAramaOp === 'not_contains' || siemAramaOp === 'not_equals' ? s.excelChipNeg : ''
									}`}
								>
									{siemAramaAlani}: &quot;{siemArama}&quot;
									<button
										type="button"
										className={s.excelChipClose}
										onClick={() => {
											setSiemArama('');
											void fetchSiemFiltered({ arama: '' });
										}}
									>
										<X size={12} />
									</button>
								</span>
							)}
						</div>
					)}
				</div>

				{/* Table */}
				{siemLogs.length === 0 ? (
					<div className={s.emptyState}>
						{isEn ? 'No forensic logs match the current criteria.' : 'Seçilen kriterlere uygun SIEM kaydı bulunamadı.'}
					</div>
				) : (
					<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>{isEn ? 'Timestamp' : 'Zaman'}</th>
									<th>{isEn ? 'Level' : 'Seviye'}</th>
									<th>{isEn ? 'Service' : 'Servis'}</th>
									<th>{isEn ? 'Event & Forensic Payload' : 'AppEvent Mesajı & Adli Detay'}</th>
									<th>IP</th>
									{canManage && <th>{isEn ? 'Action' : 'Müdahale'}</th>}
								</tr>
							</thead>
							<tbody>
								{siemLogs.map((log) => {
									const hasDetay = Boolean(log.detay && Object.keys(log.detay).length > 0);
									const isExpanded = expandedLogIds.has(log.id);
									const sevClass =
										log.seviye === 'CRITICAL' || log.seviye === 'ERROR'
											? s.badgeDanger
											: log.seviye === 'WARN'
											? s.badgeWarn
											: s.badgeInfo;
									const canBanLogIp =
										canManage &&
										log.ip &&
										log.ip !== 'unknown' &&
										log.ip !== '127.0.0.1' &&
										log.ip !== '::1' &&
										log.ip !== callerIp;

									return (
										<tr key={log.id}>
											<td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
												<span
													data-type="timestamp"
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select timestamp' : 'Zaman damgasını seçmek için çift tıklayın'}
												>
													{formatDateTime(log.zaman, language)}
												</span>
											</td>
											<td>
												<span
													data-type="level"
													className={`${s.badge} ${sevClass} ${s.selectableData}`}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select level' : 'Seviyeyi seçmek için çift tıklayın'}
												>
													{log.seviye}
												</span>
												<button
													type="button"
													className={s.quickExcludeBtn}
													title={isEn ? `Exclude level ${log.seviye}` : `Bu seviyeyi dışla (${log.seviye} hariç)`}
													onClick={() => handleQuickExcludeSeviye(log.seviye)}
												>
													≠
												</button>
											</td>
											<td>
												<span
													data-type="service"
													data-value={log.servis}
													className={`${s.badge} ${s.badgeNeutral} ${s.mono} ${s.selectableData}`}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select service' : 'Servisi seçmek için çift tıklayın'}
												>
													{log.servis}
												</span>
												<button
													type="button"
													className={s.quickExcludeBtn}
													title={isEn ? `Exclude service ${log.servis}` : `Bu servisi dışla (${log.servis} hariç)`}
													onClick={() => handleQuickExcludeServis(log.servis)}
												>
													≠
												</button>
											</td>
											<td>
												<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
													<span
														data-type="message"
														className={s.selectableData}
														onDoubleClick={handleSelectDataOnDoubleClick}
														title={isEn ? 'Double-click to select message' : 'Mesajı seçmek için çift tıklayın'}
													>
														{formatSocAlertMessage(log.mesaj, isEn)}
													</span>
													<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
														<button
															type="button"
															className={s.actionBtn}
															onClick={() => openInspector({ type: 'event', data: log })}
															style={{ padding: '2px 7px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
															title={isEn ? 'Open 3-Pane Forensic Inspector (⌥I)' : 'Adli İnceleme Çekmecesini Aç (⌥I)'}
														>
															<Eye size={12} />
															<span>{isEn ? 'Inspect' : 'İncele'}</span>
														</button>
														{hasDetay && (
															<button
																type="button"
																className={s.actionBtn}
																onClick={() => toggleLogDetail(log.id)}
																style={{ padding: '2px 7px', fontSize: 11 }}
															>
																{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
																JSON
															</button>
														)}
													</div>
												</div>
												{log.userId && (
													<div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }} className={s.mono}>
														Actor:{' '}
														<span
															data-type="user"
															data-value={log.userId}
															className={s.selectableData}
															onDoubleClick={handleSelectDataOnDoubleClick}
															title={isEn ? 'Double-click to select actor ID' : 'Aktör ID seçmek için çift tıklayın'}
														>
															{log.userId}
														</span>
													</div>
												)}
												{hasDetay && isExpanded && (
													<div style={{ marginTop: 6 }}>
														<pre className={s.detayBox}>
															{JSON.stringify(log.detay, null, 2)}
														</pre>
														{typeof log.detay === 'object' && log.detay !== null && (
															<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
																{Object.entries(log.detay).map(([k, v]) => {
																	const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
																	if (!valStr || valStr.length > 50) return null;
																	return (
																		<span key={k} className={s.siemPivotWrap}>
																			<span
																				data-type="detail"
																				className={s.selectableData}
																				onDoubleClick={handleSelectDataOnDoubleClick}
																				style={{ fontSize: 10.5, opacity: 0.75 }}
																				title={isEn ? 'Double-click to select detail' : 'Detayı seçmek için çift tıklayın'}
																			>
																				{k}: {valStr}
																			</span>
																			<button
																				type="button"
																				className={s.siemPivotBtn}
																				onClick={() => handlePivotFilter(k, valStr, 'eq')}
																				title={isEn ? `Filter equals ${k}=${valStr}` : `Eşittir filtresi ekle (${k})`}
																			>
																				{isEn ? '+ Filter' : '+ Süz'}
																			</button>
																			<button
																				type="button"
																				className={s.siemPivotBtn}
																				onClick={() => handlePivotFilter(k, valStr, 'neq')}
																				title={isEn ? `Filter not equals ${k}≠${valStr}` : `Dışla filtresi ekle (${k})`}
																			>
																				{isEn ? '≠ Exclude' : '≠ Dışla'}
																			</button>
																		</span>
																	);
																})}
															</div>
														)}
													</div>
												)}
											</td>
											<td className={s.mono}>
												<span
													data-type="ip"
													data-value={log.ip}
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select IP' : 'IP adresini seçmek için çift tıklayın'}
												>
													{log.ip || '—'}
												</span>
												{log.ip && log.ip !== 'unknown' && (
													<button
														type="button"
														className={s.quickExcludeBtn}
														title={isEn ? `Exclude IP ${log.ip}` : `Bu IP adresini dışla (${log.ip} hariç)`}
														onClick={() => handleQuickExcludeIp(log.ip)}
													>
														≠
													</button>
												)}
											</td>
											{canManage && (
												<td>
													{canBanLogIp ? (
														<button
															type="button"
															className={`${s.actionBtn} ${s.actionBtnDanger}`}
															onClick={() =>
																void handleQuickBan(
																	log.ip,
																	isEn
																		? `SIEM Forensic Quarantine (#${log.id}: ${log.servis})`
																		: `SIEM Adli Log Karantinası (#${log.id}: ${log.servis})`
																)
															}
															disabled={isSubmitting}
														>
															<Ban size={12} />
															<span>{isEn ? 'Ban IP' : 'Karantina'}</span>
														</button>
													) : (
														<span style={{ opacity: 0.4, fontSize: 11 }}>—</span>
													)}
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination */}
				{siemLogs.length > 0 && (
					<div className={s.siemPaginationBar}>
						<div className={s.siemPaginationInfo}>
							<span>{isEn ? 'Rows per page:' : 'Sayfa boyutu:'}</span>
							<select
								className={s.siemPageSelect}
								value={siemLimit}
								onChange={(e) => handleLimitChange(Number(e.target.value))}
							>
								<option value={25}>25</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
								<option value={250}>250</option>
								<option value={500}>500</option>
							</select>
							<span style={{ marginLeft: 8 }}>
								{isEn
									? `Showing ${Math.min(siemTotalCount, (siemPage - 1) * siemLimit + 1)} - ${Math.min(
											siemTotalCount,
											siemPage * siemLimit
									  )} of ${siemTotalCount.toLocaleString()} events`
									: `Toplam ${siemTotalCount.toLocaleString()} kayıttan ${Math.min(
											siemTotalCount,
											(siemPage - 1) * siemLimit + 1
									  )} - ${Math.min(siemTotalCount, siemPage * siemLimit)} arası gösteriliyor`}
							</span>
						</div>

						<div className={s.siemPaginationControls}>
							<button
								type="button"
								className={s.siemPageBtn}
								disabled={siemPage <= 1}
								onClick={() => handlePageChange(1)}
								title={isEn ? 'First page' : 'İlk sayfa'}
							>
								<ChevronsLeft size={14} />
							</button>
							<button
								type="button"
								className={s.siemPageBtn}
								disabled={siemPage <= 1}
								onClick={() => handlePageChange(siemPage - 1)}
								title={isEn ? 'Previous page' : 'Önceki sayfa'}
							>
								<ChevronLeft size={14} />
							</button>

							<span style={{ margin: '0 6px', fontSize: 11.5, color: 'var(--text-secondary)' }}>
								{isEn ? 'Page' : 'Sayfa'}{' '}
								<strong style={{ color: 'var(--text-primary)' }}>{siemPage}</strong> /{' '}
								{siemTotalPages || 1}
							</span>

							<button
								type="button"
								className={s.siemPageBtn}
								disabled={siemPage >= siemTotalPages}
								onClick={() => handlePageChange(siemPage + 1)}
								title={isEn ? 'Next page' : 'Sonraki sayfa'}
							>
								<ChevronRight size={14} />
							</button>
							<button
								type="button"
								className={s.siemPageBtn}
								disabled={siemPage >= siemTotalPages}
								onClick={() => handlePageChange(siemTotalPages)}
								title={isEn ? 'Last page' : 'Son sayfa'}
							>
								<ChevronsRight size={14} />
							</button>

							<div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 10 }}>
								<span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
									{isEn ? 'Go to:' : 'Git:'}
								</span>
								<input
									type="number"
									min={1}
									max={siemTotalPages || 1}
									className={s.siemPageJumpInput}
									value={pageJump}
									placeholder={String(siemPage)}
									onChange={(e) => setPageJump(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') handlePageJumpSubmit();
									}}
								/>
							</div>
						</div>
					</div>
				)}
			</section>
		</div>
	);
});
