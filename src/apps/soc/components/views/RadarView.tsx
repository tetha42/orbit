'use client';

import React, { useMemo } from 'react';
import {
	Activity,
	Ban,
	ShieldAlert,
	Lock,
	Flame,
	AlertTriangle,
	ShieldCheck,
	UserX,
	HardDrive,
	Server,
	Globe,
	Info,
	Database,
	Cpu,
	Radio,
	FileSearch,
	EyeOff,
	RefreshCw,
	ChevronDown,
	ChevronUp,
	X,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { formatDateTime } from '../../types';
import { formatSocAlertMessage } from '../../utils/alertLocalization';
import s from '../../Soc.module.css';

export const RadarView = React.memo(function RadarView() {
	const [showServerTelemetry, setShowServerTelemetry] = React.useState(false);
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
		isEn,
		setActiveTab,
		handleToggleKillSwitch,
		handleClearRateLimit,
		handleQuickBan,
		handleUnban,
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
		globalSearch,
		openInspector,
		selectedHourFilter,
		setSelectedHourFilter,
	} = useSoc();

	const query = globalSearch.trim().toLowerCase();
	const filteredAttackers = useMemo(() => {
		return (overview?.topAttackers ?? []).filter((att) => {
			if (!query) return true;
			return (
				att.ip.toLowerCase().includes(query) ||
				att.sonMesaj.toLowerCase().includes(query) ||
				formatSocAlertMessage(att.sonMesaj, isEn).toLowerCase().includes(query) ||
				att.status.toLowerCase().includes(query)
			);
		});
	}, [overview?.topAttackers, query, isEn]);

	const filteredRateLimits = useMemo(() => {
		return (overview?.metrics.activeRateLimits ?? []).filter((rl) => {
			if (!query) return true;
			return rl.key.toLowerCase().includes(query);
		});
	}, [overview?.metrics.activeRateLimits, query]);

	const histogramData = useMemo(() => {
		const points =
			overview?.hourlyDistribution && overview.hourlyDistribution.length > 0
				? overview.hourlyDistribution
				: (overview?.hourlyTimeline ?? []).map((h) => ({
						hourLabel: h.hourLabel,
						timestamp: h.timestamp,
						blockedCount: h.errorCount,
						warningCount: h.warnCount,
						totalCount: h.warnCount + h.errorCount,
				  }));

		if (points.length === 0) {
			return { points: [], maxVal: 5, barWidth: 24, totalWidth: 800, step: 800 };
		}

		const maxVal = Math.max(5, ...points.map((p) => p.totalCount));
		const barWidth = 24;
		const totalWidth = 800;
		const step = totalWidth / Math.max(1, points.length);

		return {
			points,
			maxVal,
			barWidth,
			totalWidth,
			step,
		};
	}, [overview?.hourlyDistribution, overview?.hourlyTimeline]);

	const filteredLiveEvents = useMemo(() => {
		return siemLogs.filter((ev) => {
			if (selectedHourFilter) {
				if (ev.zaman < selectedHourFilter.start || ev.zaman > selectedHourFilter.end) {
					return false;
				}
			}
			if (!query) return true;
			return (
				(ev.ip && ev.ip.toLowerCase().includes(query)) ||
				ev.mesaj.toLowerCase().includes(query) ||
				ev.servis.toLowerCase().includes(query) ||
				ev.seviye.toLowerCase().includes(query)
			);
		});
	}, [siemLogs, query, selectedHourFilter]);

	return (
		<div className={s.viewContainer}>
			{/* KPI Metrics */}
			<div className={s.kpiGrid}>
				<div className={s.kpiCard}>
					<div className={s.kpiHeader}>
						<span>{isEn ? 'Quarantined IPs' : 'Karantinadaki IP'}</span>
						<Ban size={15} color="var(--danger, #d70015)" />
					</div>
					<div className={s.kpiValue} style={{ color: 'var(--danger, #d70015)' }}>
						{overview?.metrics.activeBansCount ?? 0}
					</div>
					<div className={s.kpiSub}>
						{isEn
							? `${overview?.metrics.whitelistedCount ?? 0} whitelisted trusted IPs`
							: `${overview?.metrics.whitelistedCount ?? 0} güvenilir (whitelist) IP`}
					</div>
				</div>

				<div className={s.kpiCard}>
					<div className={s.kpiHeader}>
						<span>{isEn ? 'Security Events (24h)' : 'Güvenlik AppEventı (24s)'}</span>
						<ShieldAlert size={15} color="var(--warning, #c45500)" />
					</div>
					<div className={s.kpiValue}>{overview?.metrics.securityEvents24h ?? 0}</div>
					<div className={s.kpiSub}>
						{isEn ? 'WARN & ERROR level alerts' : 'WARN ve ERROR seviyesi alarmlar'}
					</div>
				</div>

				<div className={s.kpiCard}>
					<div className={s.kpiHeader}>
						<span>{isEn ? 'Auth / Brute-Force (24h)' : 'Kimlik & Brute-Force (24s)'}</span>
						<Lock size={15} color="#f97316" />
					</div>
					<div className={s.kpiValue}>{overview?.metrics.authFailures24h ?? 0}</div>
					<div className={s.kpiSub}>
						{isEn ? 'Failed logins & 2FA challenges' : 'Başarısız giriş ve 2FA denemeleri'}
					</div>
				</div>

				<div className={s.kpiCard}>
					<div className={s.kpiHeader}>
						<span>{isEn ? 'WAF / Honeypot / CSRF' : 'WAF / Honeypot / CSRF'}</span>
						<Flame size={15} color="var(--danger, #d70015)" />
					</div>
					<div className={s.kpiValue} style={{ color: 'var(--danger, #d70015)' }}>
						{overview?.metrics.csrfAndIdor24h ?? 0}
					</div>
					<div className={s.kpiSub}>
						{isEn ? 'Blocked exploit & decoy probes' : 'Engellenen exploit ve tuzak istekleri'}
					</div>
				</div>

				<div className={s.kpiCard}>
					<div className={s.kpiHeader}>
						<span>{isEn ? 'Session IP Anomalies' : 'Oturum IP Anomalisi'}</span>
						<AlertTriangle size={15} color="var(--warning, #c45500)" />
					</div>
					<div className={s.kpiValue}>{overview?.metrics.sessionAnomalies24h ?? 0}</div>
					<div className={s.kpiSub}>
						{isEn ? 'Mid-session IP changes (24h)' : 'Oturum içi IP değişim şüphesi (24s)'}
					</div>
				</div>

				<div className={s.kpiCard}>
					<div className={s.kpiHeader}>
						<span>{isEn ? 'Active Sessions' : 'Aktif Oturumlar'}</span>
						<ShieldCheck size={15} color="var(--success, #248a3d)" />
					</div>
					<div className={s.kpiValue} style={{ color: 'var(--success, #248a3d)' }}>
						{overview?.metrics.activeSessionsCount ?? sessions.length}
					</div>
					<div className={s.kpiSub}>
						{isEn ? `Your IP: ${callerIp || 'local'}` : `Sizin IP: ${callerIp || 'yerel'}`}
					</div>
				</div>

				<div
					className={s.kpiCard}
					style={{ cursor: 'pointer' }}
					onClick={() => setActiveTab('firewall')}
					role="button"
					tabIndex={0}
				>
					<div className={s.kpiHeader}>
						<span>{isEn ? 'Rate Limit Throttles' : 'Hız Sınırı Kısıtlamaları'}</span>
						<Activity size={15} color="var(--accent, #0071e3)" />
					</div>
					<div className={s.kpiValue} style={{ color: 'var(--accent, #0071e3)' }}>
						{overview?.metrics.activeRateLimitsCount ?? (overview?.metrics.activeRateLimits?.length ?? 0)}
					</div>
					<div className={s.kpiSub}>
						{isEn ? 'In-memory throttled keys (Click to view)' : 'Aktif bellek-içi limit sayaçları (Görüntüle)'}
					</div>
				</div>
			</div>

			{/* Stateful Incident Triage & Response Board */}
			<section className={s.card}>
				<div className={s.cardHeader}>
					<div>
						<h2 className={s.cardTitle}>
							<ShieldAlert size={16} />
							{isEn ? 'Incident Management & Triage Kanban' : 'Güvenlik AppEventı Yönetimi ve Triyaj Masası'}
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Active security incidents, analyst notes, and end-to-end containment lifecycle'
								: 'Aktif güvenlik olayları, analist adli notları ve uçtan uca tehdit tecrit yaşam döngüsü'}
						</p>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<span
							className={`${s.badge} ${
								(incidents?.filter((i) => i.status !== 'resolved' && i.status !== 'false_positive').length ?? 0) > 0
									? s.badgeDanger
									: s.badgeSuccess
							}`}
						>
							{isEn
								? `${incidents?.filter((i) => i.status !== 'resolved' && i.status !== 'false_positive').length ?? 0} ACTIVE`
								: `${incidents?.filter((i) => i.status !== 'resolved' && i.status !== 'false_positive').length ?? 0} AKTİF`}
						</span>
					</div>
				</div>

				{(incidents?.length ?? 0) > 0 ? (
					<div className={s.tableContainer} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>{isEn ? 'Status' : 'Durum'}</th>
									<th>{isEn ? 'Severity' : 'Önem'}</th>
									<th>{isEn ? 'Incident Title' : 'AppEvent Başlığı'}</th>
									<th>{isEn ? 'Source IP' : 'Kaynak IP'}</th>
									<th>{isEn ? 'Service' : 'Servis'}</th>
									<th>{isEn ? 'Created At' : 'Oluşturulma'}</th>
									<th>{isEn ? 'Actions' : 'Müdahale'}</th>
								</tr>
							</thead>
							<tbody>
								{incidents.slice(0, 10).map((inc) => (
									<tr key={inc.id}>
										<td>
											<span
												className={
													inc.status === 'new'
														? s.badgeFail
														: inc.status === 'investigating' || inc.status === 'triaged'
														? s.badgeWarn
														: inc.status === 'contained'
														? s.badgePrimary
														: s.statTag
												}
											>
												{inc.status.toUpperCase()}
											</span>
										</td>
										<td>
											<span
												style={{
													fontSize: 10.5,
													fontWeight: 700,
													padding: '2px 6px',
													borderRadius: 4,
													background:
														inc.severity === 'CRITICAL'
															? 'rgba(255, 59, 48, 0.15)'
															: inc.severity === 'HIGH'
															? 'rgba(255, 149, 0, 0.15)'
															: 'rgba(0, 113, 227, 0.15)',
													color:
														inc.severity === 'CRITICAL'
															? '#d70015'
															: inc.severity === 'HIGH'
															? '#b25000'
															: '#0071e3',
												}}
											>
												{inc.severity}
											</span>
										</td>
										<td style={{ fontWeight: 600, fontSize: 12 }}>
											{inc.title}
										</td>
										<td className={s.mono} style={{ fontSize: 11 }}>
											{inc.sourceIp ? (
												<span
													data-type="ip"
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
												>
													{inc.sourceIp}
												</span>
											) : (
												'—'
											)}
										</td>
										<td style={{ fontSize: 11 }}>{inc.service || 'security'}</td>
										<td style={{ fontSize: 11, opacity: 0.75 }}>
											{formatDateTime(inc.createdAt, language)}
										</td>
										<td>
											<button
												type="button"
												className={s.actionBtn}
												style={{ height: 24, padding: '0 8px', fontSize: 11 }}
												onClick={() => openInspector({ type: 'incident', data: inc })}
											>
												<span>{isEn ? 'Inspect & Triage' : 'İncele & Triyaj'}</span>
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div className={s.cleanState}>
						<ShieldCheck size={20} />
						<div>
							<strong>{isEn ? 'No Active Security Incidents' : 'Aktif Tehdit AppEventı Bulunmuyor'}</strong>
							<div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>
								{isEn
									? 'All automated defense shields operational. No uncontained security breaches or intrusion alerts recorded.'
									: 'Siber savunma kalkanları devrede. Sistemde müdahale bekleyen açık ihlal veya saldırı olayı bulunmuyor.'}
							</div>
						</div>
					</div>
				)}
			</section>

			{/* Emergency Kill Switches */}
			<section className={s.card}>
				<div className={s.cardHeader}>
					<div>
						<h2 className={s.cardTitle}>
							<ShieldAlert size={16} />
							{isEn ? 'Emergency Kill-Switches (Surface Isolation)' : 'Acil Durum Saldırı İzolasyon Anahtarları (Kill-Switches)'}
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Instant critical API surface isolation during active zero-day or credential-stuffing campaigns'
								: 'Aktif saldırı veya sızıntı anında kritik saldırı yüzeylerini anında izole edin (Veritabanında kalıcıdır)'}
						</p>
					</div>
					<span
						className={`${s.badge} ${
							overview?.emergencySwitches?.disableRegistrations ||
							overview?.emergencySwitches?.disableUploads ||
							overview?.emergencySwitches?.passkeyOnly
								? s.badgeDanger
								: s.badgeSuccess
						}`}
					>
						{overview?.emergencySwitches?.disableRegistrations ||
						overview?.emergencySwitches?.disableUploads ||
						overview?.emergencySwitches?.passkeyOnly
							? isEn
								? 'SHIELD ACTIVE'
								: 'KORUMA DEVREDE'
							: isEn
							? 'NORMAL'
							: 'STANDART'}
					</span>
				</div>

				<div className={s.killSwitchesGrid}>
					<div className={`${s.killSwitchCard} ${overview?.emergencySwitches?.disableRegistrations ? s.killSwitchCardActive : ''}`}>
						<div className={s.killSwitchInfo}>
							<div className={s.killSwitchTitle}>
								<UserX size={15} />
								{isEn ? 'Stop Registrations' : 'Yeni Kayıtları Durdur'}
							</div>
							<div className={s.killSwitchDesc}>
								{isEn
									? 'Blocks all POST /api/auth/register and OTP calls with 503 Service Unavailable.'
									: 'Tüm üye olma ve OTP doğrulama akışlarını 503 hatasıyla derhal askıya alır.'}
							</div>
						</div>
						{canManage && (
							<button
								type="button"
								className={`${s.switchToggleBtn} ${overview?.emergencySwitches?.disableRegistrations ? s.switchToggleBtnActive : ''}`}
								onClick={() => void handleToggleKillSwitch('disableRegistrations', !overview?.emergencySwitches?.disableRegistrations)}
								disabled={isSubmitting}
							>
								{overview?.emergencySwitches?.disableRegistrations
									? isEn
										? 'ACTIVE (503)'
										: 'DEVREDE (503)'
									: isEn
									? 'OFF'
									: 'KAPALI'}
							</button>
						)}
					</div>

					<div className={`${s.killSwitchCard} ${overview?.emergencySwitches?.disableUploads ? s.killSwitchCardActive : ''}`}>
						<div className={s.killSwitchInfo}>
							<div className={s.killSwitchTitle}>
								<HardDrive size={15} />
								{isEn ? 'Stop File Uploads' : 'Dosya Yüklemelerini Durdur'}
							</div>
							<div className={s.killSwitchDesc}>
								{isEn
									? 'Suspends POST /api/upload to prevent webshells or multipart payload exploits.'
									: 'Olası webshell ve multipart sızıntılarına karşı tüm yükleme API isteklerini durdurur.'}
							</div>
						</div>
						{canManage && (
							<button
								type="button"
								className={`${s.switchToggleBtn} ${overview?.emergencySwitches?.disableUploads ? s.switchToggleBtnActive : ''}`}
								onClick={() => void handleToggleKillSwitch('disableUploads', !overview?.emergencySwitches?.disableUploads)}
								disabled={isSubmitting}
							>
								{overview?.emergencySwitches?.disableUploads
									? isEn
										? 'ACTIVE (503)'
										: 'DEVREDE (503)'
									: isEn
									? 'OFF'
									: 'KAPALI'}
							</button>
						)}
					</div>

					<div className={`${s.killSwitchCard} ${overview?.emergencySwitches?.passkeyOnly ? s.killSwitchCardActive : ''}`}>
						<div className={s.killSwitchInfo}>
							<div className={s.killSwitchTitle}>
								<Lock size={15} />
								{isEn ? 'Passkey-Only Mode' : 'Yalnızca Passkey / Biyometrik'}
							</div>
							<div className={s.killSwitchDesc}>
								{isEn
									? 'Shuts down password logins (403); only hardware Passkey / Biometrics allowed.'
									: 'Parola ile girişleri reddeder (403); yalnızca FIDO2 / Biyometrik Passkey ile girişe izin verir.'}
							</div>
						</div>
						{canManage && (
							<button
								type="button"
								className={`${s.switchToggleBtn} ${overview?.emergencySwitches?.passkeyOnly ? s.switchToggleBtnActive : ''}`}
								onClick={() => void handleToggleKillSwitch('passkeyOnly', !overview?.emergencySwitches?.passkeyOnly)}
								disabled={isSubmitting}
							>
								{overview?.emergencySwitches?.passkeyOnly
									? isEn
										? 'ACTIVE (403)'
										: 'DEVREDE (403)'
									: isEn
									? 'OFF'
									: 'KAPALI'}
							</button>
						)}
					</div>
				</div>
			</section>

			{/* Ingress & Container Runtime Telemetry */}
			{ingressDiagnostics && (
				<section className={s.card}>
					<div className={s.cardHeader}>
						<div>
							<h2 className={s.cardTitle}>
								<Server size={16} />
								{isEn ? 'Docker Container & Edge Ingress Diagnostics' : 'Docker Konteyner & Ingress Ağ Teşhisi'}
							</h2>
							<p className={s.cardSub}>
								{isEn
									? 'Client IP resolution pipeline, proxy headers, and Docker bridge self-lockout guard'
									: 'Ters vekil (Reverse Proxy) IP çözümlemesi ve Docker köprü ağı self-lockout koruması'}
							</p>
						</div>
						<span className={`${s.badge} ${ingressDiagnostics.isDockerBridgeOrPrivate ? s.badgeWarn : s.badgeSuccess}`}>
							{ingressDiagnostics.isDockerBridgeOrPrivate
								? isEn
									? 'BRIDGE IP PROTECTED'
									: 'DOCKER KÖPRÜ KORUMASI'
								: isEn
								? 'REAL IP DETECTED'
								: 'GERÇEK İSTEMCİ IP'}
						</span>
					</div>

					<div className={s.ingressGrid}>
						<div className={s.ingressItem}>
							<span className={s.ingressLabel}>{isEn ? 'Environment' : 'Çalışma Ortamı'}</span>
							<span className={s.ingressValue}>
								<Cpu size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
								{ingressDiagnostics.isContainerEnvironment ? 'Docker (node:22-alpine)' : 'Host / Bare-Metal'}
							</span>
						</div>

						<div className={s.ingressItem}>
							<span className={s.ingressLabel}>{isEn ? 'Detected Ingress' : 'Kenar Ağ (Edge Proxy)'}</span>
							<span className={s.ingressValue}>
								<Globe size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
								{ingressDiagnostics.detectedEdge.toUpperCase()}
							</span>
						</div>

						<div className={s.ingressItem}>
							<span className={s.ingressLabel}>{isEn ? 'Resolved Client IP' : 'Çözümlenen İstemci IP'}</span>
							<span className={`${s.ingressValue} ${s.mono}`}>
								{ingressDiagnostics.detectedClientIp || callerIp || '—'}
							</span>
						</div>

						<div className={s.ingressItem}>
							<span className={s.ingressLabel}>{isEn ? 'Self-Lockout Shield' : 'Kendi Kendini Kilitlememe'}</span>
							<span className={s.ingressValue}>
								{ingressDiagnostics.isDockerBridgeOrPrivate ? (
									<span style={{ color: 'var(--warning, #c45500)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
										<ShieldAlert size={13} />
										{isEn ? 'Bridge / Local IP Protected' : 'Köprü / Yerel IP Asla Banlanmaz'}
									</span>
								) : (
									<span style={{ color: 'var(--success, #248a3d)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
										<ShieldCheck size={13} />
										{isEn ? 'Direct & Secure Resolution' : 'Güvenli ve Doğrudan Çözümlendi'}
									</span>
								)}
							</span>
						</div>
					</div>
					{ingressDiagnostics.recommendation && (
						<div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
							<Info size={13} />
							<span>
								<strong>{isEn ? 'Recommendation:' : 'Öneri:'}</strong>{' '}
								{isEn && ingressDiagnostics.recommendation.includes('Docker Köprü')
									? 'Docker bridge / RFC1918 network detected. Reverse proxy must forward X-Forwarded-For headers.'
									: !isEn && ingressDiagnostics.recommendation.includes('Docker bridge')
									? 'Docker Köprü / RFC1918 ağı algılandı. Ters vekil (Reverse Proxy) X-Forwarded-For başlıklarını iletmelidir.'
									: ingressDiagnostics.recommendation}
							</span>
						</div>
					)}
				</section>
			)}

			{/* Interactive 24-Hour Attack Spike Histogram (SVG) */}
			<section className={`${s.card} ${s.histogramWrap}`}>
				<div className={s.histogramHeader}>
					<div>
						<h2 className={s.cardTitle} style={{ fontSize: 14 }}>
							<Activity size={15} />
							{isEn ? '24-Hour Attack Spike Histogram' : '24 Saatlik Saldırı & Tehdit Dağılım Histogramı'}
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Interactive hourly strike density for blocked attacks (red) vs warnings (orange)'
								: 'Saatlik engellenen kritik saldırılar (kırmızı) ve uyarıların (turuncu) interaktif dağılımı'}
						</p>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
						{selectedHourFilter && (
							<button
								type="button"
								className={s.btnSecondary}
								style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
								onClick={() => setSelectedHourFilter(null)}
							>
								<X size={12} />
								{isEn ? `Clear filter: ${selectedHourFilter.hourLabel}` : `Filtreyi temizle: ${selectedHourFilter.hourLabel}`}
							</button>
						)}
						<div className={s.histogramLegend}>
							<div className={s.legendItem}>
								<div className={s.legendDotDanger} />
								<span>{isEn ? 'Blocked (IPS/ERROR)' : 'Engellendi (IPS/ERROR)'}</span>
							</div>
							<div className={s.legendItem}>
								<div className={s.legendDotWarn} />
								<span>{isEn ? 'Warning (WARN)' : 'Uyarı (WARN)'}</span>
							</div>
						</div>
					</div>
				</div>

				{histogramData.points.length === 0 ? (
					<div className={s.histogramEmpty}>
						<ShieldCheck size={28} color="var(--success, #248a3d)" />
						<span>{isEn ? 'No telemetry data recorded for the last 24 hours' : 'Son 24 saat için kayıtlı telemetri verisi bulunmuyor'}</span>
					</div>
				) : (
					<svg viewBox="0 0 800 240" className={s.histogramSvg} preserveAspectRatio="none">
						<line x1="0" y1="25" x2="800" y2="25" stroke="var(--border-subtle, rgba(0,0,0,0.08))" strokeDasharray="3 3" />
						<line x1="0" y1="68" x2="800" y2="68" stroke="var(--border-subtle, rgba(0,0,0,0.08))" strokeDasharray="3 3" />
						<line x1="0" y1="110" x2="800" y2="110" stroke="var(--border-subtle, rgba(0,0,0,0.08))" strokeDasharray="3 3" />
						<line x1="0" y1="152" x2="800" y2="152" stroke="var(--border-subtle, rgba(0,0,0,0.08))" strokeDasharray="3 3" />
						<line x1="0" y1="195" x2="800" y2="195" stroke="var(--border-subtle, rgba(0,0,0,0.18))" />

						{histogramData.points.map((p, idx) => {
							const x = idx * histogramData.step + (histogramData.step - histogramData.barWidth) / 2;
							const maxBarH = 170;
							const blockedH = (p.blockedCount / histogramData.maxVal) * maxBarH;
							const warnH = (p.warningCount / histogramData.maxVal) * maxBarH;
							const totalH = blockedH + warnH;
							const yBlocked = 195 - blockedH;
							const yWarn = yBlocked - warnH;
							const isSelected = selectedHourFilter?.hourLabel === p.hourLabel;

							return (
								<g
									key={p.timestamp || idx}
									className={s.histogramBar}
									style={{ cursor: 'pointer' }}
									onClick={() => {
										if (isSelected) {
											setSelectedHourFilter(null);
										} else {
											setSelectedHourFilter({
												hourLabel: p.hourLabel,
												start: p.timestamp,
												end: p.timestamp + 3600000,
											});
										}
									}}
								>
									<title>
										{isEn
											? `${p.hourLabel}: Total ${p.totalCount} events (${p.blockedCount} blocked, ${p.warningCount} warnings) — Click to filter stream`
											: `${p.hourLabel}: Toplam ${p.totalCount} olay (${p.blockedCount} engellendi, ${p.warningCount} uyarı) — Akışı filtrelemek için tıklayın`}
									</title>
									<rect
										x={idx * histogramData.step}
										y="10"
										width={histogramData.step}
										height="205"
										fill={isSelected ? 'color-mix(in srgb, var(--accent, #0071e3) 14%, transparent)' : 'transparent'}
										rx="3"
									/>
									{warnH > 0 && (
										<rect x={x} y={yWarn} width={histogramData.barWidth} height={warnH} rx="2" fill="var(--warning, #c45500)" opacity={isSelected ? 1 : 0.9} />
									)}
									{blockedH > 0 && (
										<rect x={x} y={yBlocked} width={histogramData.barWidth} height={blockedH} rx="2" fill="var(--danger, #d70015)" opacity={isSelected ? 1 : 0.95} />
									)}
									{totalH === 0 && (
										<circle cx={x + histogramData.barWidth / 2} cy="193" r="1.5" fill="var(--text-secondary, #6e6e73)" opacity="0.3" />
									)}
									<text
										x={x + histogramData.barWidth / 2}
										y={214}
										textAnchor="middle"
										fontSize="9.5"
										fontWeight={isSelected ? 'bold' : 'normal'}
										fill={isSelected ? 'var(--accent, #0071e3)' : 'var(--text-secondary, #6e6e73)'}
									>
										{p.hourLabel.slice(0, 2)}
									</text>
								</g>
							);
						})}
					</svg>
				)}
			</section>

			{/* System & PostgreSQL Connection Pool Telemetry */}
			{overview?.systemTelemetry && (
				<section className={s.card}>
					<div className={s.cardHeader}>
						<div>
							<h2 className={s.cardTitle}>
								<Database size={16} />
								{isEn ? 'Host & PostgreSQL Connection Pool Telemetry' : 'Sunucu & PostgreSQL Bağlantı Havuzu Telemetrisi'}
							</h2>
							<p className={s.cardSub}>
								{isEn
									? 'Real-time database connection saturation, host memory, and CPU load'
									: 'Gerçek zamanlı veritabanı havuz doyum seviyesi, sunucu RAM kullanımı ve CPU yükü'}
							</p>
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<span className={`${s.badge} ${overview.systemTelemetry.pgPool.waitingCount > 0 ? s.badgeWarn : s.badgeSuccess}`}>
								{overview.systemTelemetry.pgPool.waitingCount > 0 ? 'QUEUE DELAY' : 'POOL HEALTHY'}
							</span>
							<button
								type="button"
								className={s.actionBtn}
								style={{ height: 24, padding: '0 8px', fontSize: 11 }}
								onClick={() => setShowServerTelemetry((prev) => !prev)}
							>
								{showServerTelemetry ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
								<span>{showServerTelemetry ? (isEn ? 'Collapse' : 'Daralt') : (isEn ? 'Expand' : 'Genişlet')}</span>
							</button>
						</div>
					</div>

					{showServerTelemetry ? (
						<div className={s.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
							<div className={s.kpiCard}>
								<div className={s.kpiHeader}>
									<span>{isEn ? 'PG Pool Active / Max' : 'PG Havuz Aktif / Limit'}</span>
									<Database size={14} color="var(--accent, #0071e3)" />
								</div>
								<div className={s.kpiValue} style={{ color: 'var(--accent, #0071e3)' }}>
									{overview.systemTelemetry.pgPool.totalCount} / {overview.systemTelemetry.pgPool.max}
								</div>
								<div className={s.kpiSub}>
									{isEn
										? `${overview.systemTelemetry.pgPool.idleCount} idle, ${overview.systemTelemetry.pgPool.waitingCount} queued`
										: `${overview.systemTelemetry.pgPool.idleCount} boşta, ${overview.systemTelemetry.pgPool.waitingCount} sırada`}
								</div>
							</div>

							<div className={s.kpiCard}>
								<div className={s.kpiHeader}>
									<span>{isEn ? 'Process Memory (Heap)' : 'Node.js Bellek (Heap)'}</span>
									<HardDrive size={14} color="#8b5cf6" />
								</div>
								<div className={s.kpiValue} style={{ color: '#8b5cf6' }}>
									{(overview.systemTelemetry.memory.processHeapUsed / 1024 / 1024).toFixed(1)} MB
								</div>
								<div className={s.kpiSub}>
									RSS: {(overview.systemTelemetry.memory.processRss / 1024 / 1024).toFixed(1)} MB
								</div>
							</div>

							<div className={s.kpiCard}>
								<div className={s.kpiHeader}>
									<span>{isEn ? 'Host System RAM' : 'Sunucu RAM Kullanımı'}</span>
									<Cpu size={14} color="var(--success, #248a3d)" />
								</div>
								<div className={s.kpiValue} style={{ color: 'var(--success, #248a3d)' }}>
									{(overview.systemTelemetry.memory.osUsed / 1024 / 1024 / 1024).toFixed(2)} GB
								</div>
								<div className={s.kpiSub}>
									{isEn ? 'Total Host RAM:' : 'Toplam RAM:'} {(overview.systemTelemetry.memory.osTotal / 1024 / 1024 / 1024).toFixed(2)} GB
								</div>
							</div>

							<div className={s.kpiCard}>
								<div className={s.kpiHeader}>
									<span>{isEn ? 'CPU Load Average' : 'CPU Yük Ortalaması'}</span>
									<Activity size={14} color="var(--warning, #c45500)" />
								</div>
								<div className={s.kpiValue} style={{ color: 'var(--warning, #c45500)' }}>
									{overview.systemTelemetry.cpu.loadAvg.map((l) => l.toFixed(2)).join(' · ')}
								</div>
								<div className={s.kpiSub}>
									{isEn ? 'Uptime:' : 'Çalışma Süresi:'} {Math.floor(overview.systemTelemetry.cpu.uptime / 3600)}s {Math.floor((overview.systemTelemetry.cpu.uptime % 3600) / 60)}d
								</div>
							</div>
						</div>
					) : (
						<div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11.5, color: 'var(--text-secondary)', padding: '2px 0' }}>
							<span><strong>PG Pool:</strong> {overview.systemTelemetry.pgPool.totalCount}/{overview.systemTelemetry.pgPool.max} ({overview.systemTelemetry.pgPool.idleCount} idle)</span>
							<span><strong>Heap:</strong> {(overview.systemTelemetry.memory.processHeapUsed / 1024 / 1024).toFixed(1)} MB</span>
							<span><strong>RAM:</strong> {(overview.systemTelemetry.memory.osUsed / 1024 / 1024 / 1024).toFixed(2)} GB / {(overview.systemTelemetry.memory.osTotal / 1024 / 1024 / 1024).toFixed(2)} GB</span>
							<span><strong>Load:</strong> {overview.systemTelemetry.cpu.loadAvg[0]?.toFixed(2)}</span>
						</div>
					)}
				</section>
			)}

				<section className={s.card}>
					<div className={s.cardHeader}>
						<div>
							<h2 className={s.cardTitle}>
								<Flame size={16} />
								{isEn ? 'Top Attacking IPs & Threat Scores (24h)' : 'En Saldırgan IP Adresleri & Tehdit Skorları (24s)'}
							</h2>
							<p className={s.cardSub}>
								{isEn
									? 'IPs reaching 100 points within 15m are automatically quarantined'
									: '15 dakika içinde 100 tehdit puanına ulaşan IP adresleri otomatik karantinaya alınır'}
							</p>
						</div>
					</div>

					{filteredAttackers.length === 0 ? (
						<div className={s.emptyState}>
							{isEn
								? query
									? 'No hostile IP activity matching your search query.'
									: 'No hostile IP activity recorded in the last 24 hours.'
								: query
								? 'Arama kriterine uygun şüpheli veya saldırgan IP bulunamadı.'
								: 'Son 24 saatte şüpheli veya saldırgan IP aktivitesi tespit edilmedi.'}
						</div>
					) : (
						<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
							<table className={s.table}>
								<thead>
									<tr>
										<th>IP</th>
										<th>{isEn ? 'Score' : 'Puan'}</th>
										<th>{isEn ? 'Status' : 'Durum'}</th>
										<th>{isEn ? 'Last Alert' : 'Son İhlal'}</th>
										{canManage && <th>{isEn ? 'Action' : 'Müdahale'}</th>}
									</tr>
								</thead>
								<tbody>
									{filteredAttackers.map((att) => {
										const pct = Math.min(100, Math.max(5, att.tehditPuani));
										const barColor =
											pct >= 80 ? 'var(--danger, #d70015)' : pct >= 50 ? 'var(--warning, #c45500)' : 'var(--accent, #0071e3)';
										return (
											<tr
												key={att.ip}
												style={{ cursor: 'pointer' }}
												onClick={() =>
													openInspector({
														type: 'ip',
														data: {
															ip: att.ip,
															attackerInfo: att,
															threatIntel: att.threatIntel,
														},
													})
												}
											>
												<td className={s.mono}>
													<div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
														<span
															data-type="ip"
															data-value={att.ip}
															className={s.selectableData}
															onDoubleClick={handleSelectDataOnDoubleClick}
															title={isEn ? 'Double-click to select IP' : 'IP adresini seçmek için çift tıklayın'}
														>
															{att.ip}
														</span>
														{(att.threatIntel?.isTorExitNode || att.threatIntel?.isTor) && (
															<span className={`${s.threatBadge} ${s.threatBadgeTor}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
																<EyeOff size={11} /> Tor
															</span>
														)}
														{(att.threatIntel?.isCloudHosting || att.threatIntel?.isDatacenter) && (
															<span className={`${s.threatBadge} ${s.threatBadgeCloud}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
																<Globe size={11} /> {att.threatIntel.provider || 'Cloud'}
															</span>
														)}
														{att.threatIntel?.riskLevel === 'HIGH' && (
															<span className={`${s.threatBadge} ${s.threatBadgeHigh}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
																<AlertTriangle size={11} /> {isEn ? 'High' : 'Yüksek'}
															</span>
														)}
													</div>
												</td>
												<td>
													<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
														<div className={s.scoreBarWrap}>
															<div className={s.scoreBarFill} style={{ width: `${pct}%`, background: barColor }} />
														</div>
														<span className={s.mono}>
															{att.tehditPuani} ({att.eventCount})
														</span>
													</div>
												</td>
												<td>
													{att.status === 'ban' ? (
														<span className={`${s.badge} ${s.badgeDanger}`}>
															{isEn ? 'BANNED' : 'KARANTİNA'}
														</span>
													) : att.status === 'whitelist' ? (
														<span className={`${s.badge} ${s.badgeSuccess}`}>WHITELIST</span>
													) : (
														<span className={`${s.badge} ${s.badgeWarn}`}>
															{isEn ? 'MONITORED' : 'İZLENİYOR'}
														</span>
													)}
												</td>
												<td style={{ maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatSocAlertMessage(att.sonMesaj, isEn)}>
													{formatSocAlertMessage(att.sonMesaj, isEn)}
												</td>
												{canManage && (
													<td onClick={(e) => e.stopPropagation()}>
														{att.status === 'ban' ? (
															<button
																type="button"
																className={s.actionBtn}
																onClick={() => void handleUnban(att.ip)}
																disabled={isSubmitting}
															>
																{isEn ? 'Unban' : 'Kaldır'}
															</button>
														) : att.ip !== callerIp ? (
															<button
																type="button"
																className={`${s.actionBtn} ${s.actionBtnDanger}`}
																onClick={() =>
																	void handleQuickBan(
																		att.ip,
																		isEn
																			? `Manual quarantine via SoC Radar (${att.eventCount} events)`
																			: `SoC Radar üzerinden manuel karantina (${att.eventCount} olay)`
																	)
																}
																disabled={isSubmitting}
															>
																<Ban size={12} />
																{isEn ? 'Ban' : 'Engelle'}
															</button>
														) : (
															<span className={`${s.badge} ${s.badgeInfo}`}>
																{isEn ? 'You' : 'Siz'}
															</span>
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
				</section>

			{/* Active In-Memory Rate Limits */}
			{filteredRateLimits.length > 0 && (
				<section className={s.card}>
					<div className={s.cardHeader}>
						<div>
							<h2 className={s.cardTitle}>
								<Activity size={16} />
								{isEn ? 'Active Rate Limits & Throttled Keys' : 'Aktif Hız Sınırı ve Kilitlenmiş İstemciler'}
							</h2>
							<p className={s.cardSub}>
								{isEn
									? 'In-memory sliding window limits currently restricting requests'
									: 'İstekleri geçici olarak durduran gerçek zamanlı bellek-içi hız sınırları'}
							</p>
						</div>
						<span className={`${s.badge} ${s.badgeWarn}`}>
							{filteredRateLimits.length} {isEn ? 'ACTIVE' : 'AKTİF'}
						</span>
					</div>

					<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>{isEn ? 'Key / Identifier' : 'Hedef / Anahtar'}</th>
									<th>{isEn ? 'Hits / Failures' : 'Sayaç / Deneme'}</th>
									<th>{isEn ? 'Retry After' : 'Kalan Süre'}</th>
									<th>{isEn ? 'Reset At' : 'Sıfırlanma'}</th>
									{canManage && <th>{isEn ? 'Action' : 'İşlem'}</th>}
								</tr>
							</thead>
							<tbody>
								{filteredRateLimits.map((rl) => (
									<tr key={rl.key}>
										<td className={s.mono}>
											<span
												data-type="key"
												className={s.selectableData}
												onDoubleClick={handleSelectDataOnDoubleClick}
												title={isEn ? 'Double-click to select key' : 'Anahtarı seçmek için çift tıklayın'}
											>
												{rl.key}
											</span>
										</td>
										<td className={s.mono}>
											<span className={`${s.badge} ${rl.count >= 5 ? s.badgeDanger : s.badgeWarn}`}>
												{rl.count}x
											</span>
										</td>
										<td className={s.mono}>{rl.retryAfter}s</td>
										<td>{formatDateTime(rl.resetAt, language)}</td>
										{canManage && (
											<td>
												<button
													type="button"
													className={`${s.actionBtn} ${s.actionBtnPrimary}`}
													onClick={() => void handleClearRateLimit(rl.key)}
													disabled={isSubmitting}
													style={{ padding: '4px 10px', fontSize: 11 }}
												>
													<RefreshCw size={11} />
													{isEn ? 'Reset Limit' : 'Hız Sınırını Sıfırla'}
												</button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}

			{/* Live Security Event Stream */}
			<section className={s.card}>
				<div className={s.cardHeader}>
					<div>
						<h2 className={s.cardTitle}>
							<Radio size={16} />
							{isEn ? 'Live Security Event Stream' : 'Canlı Güvenlik AppEvent Akışı'}
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Real-time stream of latest WAF, IPS, authentication, terminal, and database security events'
								: 'WAF, IPS, kimlik doğrulama, terminal ve veritabanı güvenlik olaylarının anlık akışı'}
						</p>
					</div>
					<button
						type="button"
						className={s.actionBtn}
						onClick={() => setActiveTab('siem')}
					>
						<FileSearch size={12} />
						{isEn ? 'Open Full SIEM' : 'Tüm SIEM Kayıtları'}
					</button>
				</div>

				{selectedHourFilter && (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							background: 'color-mix(in srgb, var(--accent, #0071e3) 10%, transparent)',
							border: '1px solid color-mix(in srgb, var(--accent, #0071e3) 24%, transparent)',
							borderRadius: 6,
							padding: '6px 12px',
							marginBottom: 10,
							fontSize: 12,
							color: 'var(--accent, #0071e3)',
						}}
					>
						<span>
							{isEn
								? `Filtering live security events for time window: ${selectedHourFilter.hourLabel}`
								: `Canlı güvenlik olayları ${selectedHourFilter.hourLabel} zaman aralığına göre filtreleniyor`}
						</span>
						<button
							type="button"
							onClick={() => setSelectedHourFilter(null)}
							style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
						>
							<X size={12} />
							<span>{isEn ? 'Clear Filter' : 'Filtreyi Temizle'}</span>
						</button>
					</div>
				)}

				{filteredLiveEvents.length === 0 ? (
					<div className={s.emptyState}>
						{isEn
							? query || selectedHourFilter
								? 'No security events match your current filter.'
								: 'No security events recorded yet.'
							: query || selectedHourFilter
							? 'Arama ve zaman kriterine uygun güvenlik olayı bulunamadı.'
							: 'Henüz kaydedilmiş güvenlik olayı bulunmuyor.'}
					</div>
				) : (
					<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>{isEn ? 'Time' : 'Zaman'}</th>
									<th>{isEn ? 'Level' : 'Seviye'}</th>
									<th>{isEn ? 'Service' : 'Servis'}</th>
									<th>{isEn ? 'Event Message' : 'AppEvent Mesajı'}</th>
									<th>IP</th>
								</tr>
							</thead>
							<tbody>
								{filteredLiveEvents.slice(0, 8).map((ev) => {
									const sevBadge =
										ev.seviye === 'CRITICAL' || ev.seviye === 'ERROR'
											? s.badgeDanger
											: ev.seviye === 'WARN'
											? s.badgeWarn
											: s.badgeInfo;
									return (
										<tr
											key={ev.id}
											style={{ cursor: 'pointer' }}
											onClick={() => openInspector({ type: 'event', data: ev })}
										>
											<td className={s.mono}>
												<span
													data-type="timestamp"
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select timestamp' : 'Zaman damgasını seçmek için çift tıklayın'}
												>
													{formatDateTime(ev.zaman, language)}
												</span>
											</td>
											<td>
												<span
													data-type="level"
													className={`${s.badge} ${sevBadge} ${s.selectableData}`}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select level' : 'Seviyeyi seçmek için çift tıklayın'}
												>
													{ev.seviye}
												</span>
											</td>
											<td>
												<span
													data-type="service"
													data-value={ev.servis}
													className={`${s.badge} ${s.badgeNeutral} ${s.selectableData}`}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select service' : 'Servisi seçmek için çift tıklayın'}
												>
													{ev.servis}
												</span>
											</td>
											<td>
												<span
													data-type="message"
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select message' : 'Mesajı seçmek için çift tıklayın'}
												>
													{ev.mesaj}
												</span>
											</td>
											<td className={s.mono}>
												<span
													data-type="ip"
													data-value={ev.ip}
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select IP' : 'IP adresini seçmek için çift tıklayın'}
												>
													{ev.ip || '—'}
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
});
