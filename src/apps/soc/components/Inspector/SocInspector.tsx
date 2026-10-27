'use client';

import React, { useState, useCallback } from 'react';
import {
	X,
	Copy,
	Check,
	ExternalLink,
	ShieldAlert,
	Ban,
	ShieldCheck,
	Terminal,
	FileText,
	Lock,
	User,
	Download,
	Flame,
	Activity,
	Globe,
	GitBranch,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { useWindowActions } from '@/core/windows';
import { formatDateTime, summarizeUa } from '../../types';
import type { SocIncidentStatus } from '../../types';
import { formatSocAlertMessage } from '../../utils/alertLocalization';
import s from './SocInspector.module.css';

export function SocInspector() {
	const {
		inspectorEntity,
		isInspectorOpen,
		closeInspector,
		isEn,
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

	const { openApp } = useWindowActions();
	const [copied, setCopied] = useState(false);
	const [notes, setNotes] = useState('');
	const [isSavingNotes, setIsSavingNotes] = useState(false);
	const [fimDiff, setFimDiff] = useState<string | null>(null);
	const [fimLoading, setFimLoading] = useState(false);

	// Sync incident notes when opening incident
	React.useEffect(() => {
		if (inspectorEntity?.type === 'incident') {
			setNotes(inspectorEntity.data.analystNotes || '');
		}
	}, [inspectorEntity]);

	// Fetch diff for FIM entity if not already present
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
						setFimDiff(d?.diff?.diff || (isEn ? 'No diff available.' : 'Fark bulunamadı.'));
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
	}, [inspectorEntity, isEn]);

	const handleCopyJson = useCallback((val: unknown) => {
		try {
			void navigator.clipboard.writeText(typeof val === 'string' ? val : JSON.stringify(val, null, 2));
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {}
	}, []);

	if (!isInspectorOpen || !inspectorEntity) {
		return null;
	}

	const renderEventView = () => {
		if (inspectorEntity.type !== 'event') return null;
		const ev = inspectorEntity.data;

		return (
			<>
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'Event Metadata' : 'AppEvent Üstverisi'}</span>
						<span
							className={`${s.badge} ${
								ev.seviye === 'CRITICAL' || ev.seviye === 'ERROR'
									? s.badgeDanger
									: ev.seviye === 'WARN'
									? s.badgeWarn
									: s.badgeNeutral
							}`}
						>
							{ev.seviye}
						</span>
					</div>

					<div className={s.gridProps}>
						<span className={s.propLabel}>{isEn ? 'Log ID' : 'Kayıt ID'}</span>
						<span className={`${s.propValue} ${s.mono}`}>#{ev.id}</span>

						<span className={s.propLabel}>{isEn ? 'Timestamp' : 'Zaman'}</span>
						<span className={s.propValue}>{formatDateTime(ev.zaman, isEn ? 'en' : 'tr')}</span>

						<span className={s.propLabel}>{isEn ? 'Service' : 'Servis'}</span>
						<span className={`${s.propValue} ${s.mono}`}>{ev.servis}</span>

						<span className={s.propLabel}>{isEn ? 'Source IP' : 'Kaynak IP'}</span>
						<span className={`${s.propValue} ${s.mono}`} data-type="ip" data-value={ev.ip}>
							{ev.ip || '—'}
						</span>

						{ev.userId && (
							<>
								<span className={s.propLabel}>{isEn ? 'User ID' : 'Kullanıcı'}</span>
								<span className={`${s.propValue} ${s.mono}`} data-type="user" data-value={ev.userId}>
									{ev.userId}
								</span>
							</>
						)}
					</div>
				</div>

				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'Log Message' : 'AppEvent Mesajı'}</span>
					</div>
					<div className={s.propValue} style={{ fontSize: 12, lineHeight: 1.4 }}>
						{formatSocAlertMessage(ev.mesaj, isEn)}
					</div>
				</div>

				{ev.detay && (
					<div className={s.sectionCard}>
						<div className={s.sectionHeader}>
							<span>{isEn ? 'Payload Details' : 'Yük & Parametre Detayları'}</span>
							<button
								type="button"
								className={s.iconBtn}
								onClick={() => handleCopyJson(ev.detay)}
								title={isEn ? 'Copy Payload JSON' : 'JSON Yükünü Kopyala'}
							>
								{copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
							</button>
						</div>
						<pre className={s.codeViewer}>{JSON.stringify(ev.detay, null, 2)}</pre>
					</div>
				)}

				{canManage && ev.ip && (
					<div className={s.sectionCard}>
						<div className={s.sectionHeader}>
							<span>{isEn ? 'Quick Containment' : 'Hızlı Müdahale'}</span>
						</div>
						<div className={s.actionGroup}>
							<button
								type="button"
								className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
								onClick={() => void handleQuickBan(ev.ip, `Manual quarantine via SIEM event #${ev.id}`)}
								disabled={isSubmitting}
							>
								<Ban size={13} />
								<span>{isEn ? `Quarantine IP (${ev.ip})` : `IP Karantinaya Al (${ev.ip})`}</span>
							</button>
							<button
								type="button"
								className={s.containmentBtn}
								onClick={() => {
									setSiemIp(ev.ip);
									setSiemIpOp('eq');
									setActiveTab('siem');
								}}
							>
								<Globe size={13} />
								<span>{isEn ? 'Filter in SIEM' : 'SIEM Günlüklerinde Filtrele'}</span>
							</button>
						</div>
					</div>
				)}
			</>
		);
	};

	const renderIpView = () => {
		if (inspectorEntity.type !== 'ip') return null;
		const { ip, threatIntel, banInfo, attackerInfo } = inspectorEntity.data;
		const threatScore = banInfo?.tehditPuani ?? attackerInfo?.tehditPuani ?? 0;
		const isBanned = banInfo?.status === 'ban' || attackerInfo?.status === 'ban';

		return (
			<>
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'Threat Score' : 'Tehdit Puanı'}</span>
						<span
							className={`${s.badge} ${
								threatScore >= 75
									? s.badgeDanger
									: threatScore >= 40
									? s.badgeWarn
									: s.badgeNeutral
							}`}
						>
							{threatScore >= 75 ? 'HIGH RISK' : threatScore >= 40 ? 'SUSPICIOUS' : 'NORMAL'}
						</span>
					</div>
					<div className={s.scoreRow}>
						<span
							className={s.scoreValue}
							style={{
								color:
									threatScore >= 75
										? 'var(--danger, #d70015)'
										: threatScore >= 40
										? 'var(--warning, #c45500)'
										: 'var(--text-primary)',
							}}
						>
							{threatScore}
							<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}>/100</span>
						</span>
						<div className={s.scoreBarWrap}>
							<div
								className={s.scoreBarFill}
								style={{
									width: `${Math.min(100, threatScore)}%`,
									background:
										threatScore >= 75
											? 'var(--danger, #d70015)'
											: threatScore >= 40
											? 'var(--warning, #c45500)'
											: 'var(--accent, #0071e3)',
								}}
							/>
						</div>
					</div>
				</div>

				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'Network & ASN Intelligence' : 'Ağ ve ASN İstihbaratı'}</span>
					</div>
					<div className={s.gridProps}>
						<span className={s.propLabel}>{isEn ? 'Provider / ISP' : 'Sağlayıcı / ISP'}</span>
						<span className={s.propValue}>{threatIntel?.provider || 'Unknown Provider'}</span>

						<span className={s.propLabel}>{isEn ? 'Datacenter' : 'Veri Merkezi'}</span>
						<span className={s.propValue}>
							{threatIntel?.isDatacenter ? (isEn ? 'Yes (Cloud/VPS)' : 'Evet (Bulut/Sunucu)') : (isEn ? 'Residential / Mobile' : 'Ev / Mobil Ağ')}
						</span>

						<span className={s.propLabel}>{isEn ? 'Tor / Proxy' : 'Tor / Anonim'}</span>
						<span className={s.propValue}>
							{threatIntel?.isTor ? (isEn ? 'Tor Exit Node' : 'Tor Çıkış Noktası') : (isEn ? 'No' : 'Hayır')}
						</span>

						{attackerInfo && (
							<>
								<span className={s.propLabel}>{isEn ? 'Total Strikes' : 'AppEvent Sayısı'}</span>
								<span className={s.propValue}>{attackerInfo.eventCount}</span>

								<span className={s.propLabel}>{isEn ? 'Last Seen' : 'Son Görülme'}</span>
								<span className={s.propValue}>{formatDateTime(attackerInfo.sonGorulme, isEn ? 'en' : 'tr')}</span>
							</>
						)}
					</div>
				</div>

				{banInfo && (
					<div className={s.sectionCard}>
						<div className={s.sectionHeader}>
							<span>{isEn ? 'Quarantine Rule' : 'Aktif Kural'}</span>
							<span className={`${s.badge} ${banInfo.status === 'ban' ? s.badgeDanger : s.badgeSuccess}`}>
								{banInfo.status.toUpperCase()}
							</span>
						</div>
						<div className={s.gridProps}>
							<span className={s.propLabel}>{isEn ? 'Reason' : 'Neden'}</span>
							<span className={s.propValue}>{formatSocAlertMessage(banInfo.neden, isEn)}</span>

							<span className={s.propLabel}>{isEn ? 'Expires At' : 'Bitiş'}</span>
							<span className={s.propValue}>
								{banInfo.expiresAt ? formatDateTime(banInfo.expiresAt, isEn ? 'en' : 'tr') : (isEn ? 'Permanent' : 'Kalıcı')}
							</span>
						</div>
					</div>
				)}

				{canManage && (
					<div className={s.sectionCard}>
						<div className={s.sectionHeader}>
							<span>{isEn ? 'Response Actions' : 'Müdahale Eylemleri'}</span>
						</div>
						<div className={s.actionGroup}>
							{isBanned ? (
								<button
									type="button"
									className={`${s.containmentBtn} ${s.containmentBtnPrimary}`}
									onClick={() => void handleUnban(ip)}
									disabled={isSubmitting}
								>
									<ShieldCheck size={13} />
									<span>{isEn ? 'Lift Quarantine (Unban)' : 'Karantinayı Kaldır'}</span>
								</button>
							) : (
								<button
									type="button"
									className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
									onClick={() => void handleQuickBan(ip, 'Manual quarantine via Threat Inspector')}
									disabled={isSubmitting}
								>
									<Ban size={13} />
									<span>{isEn ? 'Quarantine IP (24h)' : '24 Saat Karantinaya Al'}</span>
								</button>
							)}
							<button
								type="button"
								className={s.containmentBtn}
								onClick={() => {
									setSiemIp(ip);
									setSiemIpOp('eq');
									setActiveTab('siem');
								}}
							>
								<Globe size={13} />
								<span>{isEn ? 'Filter All Activity in SIEM' : 'Tüm Kayıtları SIEM ile Süz'}</span>
							</button>
						</div>
					</div>
				)}
			</>
		);
	};

	const renderIncidentView = () => {
		if (inspectorEntity.type !== 'incident') return null;
		const inc = inspectorEntity.data;

		const handleSaveNotes = async () => {
			setIsSavingNotes(true);
			await handleUpdateIncidentStatus(inc.id, inc.status, notes);
			setIsSavingNotes(false);
		};

		return (
			<>
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'Incident Lifecycle' : 'AppEvent Yaşam Döngüsü'}</span>
						<span
							className={`${s.badge} ${
								inc.severity === 'CRITICAL' || inc.severity === 'HIGH'
									? s.badgeDanger
									: s.badgeWarn
							}`}
						>
							{inc.severity}
						</span>
					</div>

					<div className={s.gridProps}>
						<span className={s.propLabel}>{isEn ? 'Incident ID' : 'AppEvent No'}</span>
						<span className={`${s.propValue} ${s.mono}`}>{inc.id}</span>

						<span className={s.propLabel}>{isEn ? 'Status' : 'Durum'}</span>
						<span className={s.propValue}>
							{canManage ? (
								<select
									value={inc.status}
									onChange={(e) => void handleUpdateIncidentStatus(inc.id, e.target.value as SocIncidentStatus, inc.analystNotes || undefined)}
									disabled={isSubmitting}
									style={{
										padding: '3px 8px',
										borderRadius: 4,
										fontSize: 11,
										background: 'var(--fill-softer)',
										border: '1px solid var(--border-subtle)',
										color: 'var(--text-primary)',
									}}
								>
									<option value="new">NEW</option>
									<option value="triaged">TRIAGED</option>
									<option value="investigating">INVESTIGATING</option>
									<option value="contained">CONTAINED</option>
									<option value="resolved">RESOLVED</option>
									<option value="false_positive">FALSE POSITIVE</option>
								</select>
							) : (
								<span className={`${s.badge} ${s.badgeNeutral}`}>{inc.status.toUpperCase()}</span>
							)}
						</span>

						{inc.sourceIp && (
							<>
								<span className={s.propLabel}>{isEn ? 'Source IP' : 'Kaynak IP'}</span>
								<span className={`${s.propValue} ${s.mono}`} data-type="ip" data-value={inc.sourceIp}>
									{inc.sourceIp}
								</span>
							</>
						)}

						{inc.service && (
							<>
								<span className={s.propLabel}>{isEn ? 'Target Service' : 'Hedef Servis'}</span>
								<span className={`${s.propValue} ${s.mono}`}>{inc.service}</span>
							</>
						)}

						<span className={s.propLabel}>{isEn ? 'Created At' : 'Oluşturulma'}</span>
						<span className={s.propValue}>{formatDateTime(inc.createdAt, isEn ? 'en' : 'tr')}</span>
					</div>
				</div>

				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'Analyst Case Notes' : 'Adli Analist Notları'}</span>
					</div>
					<textarea
						className={s.notesTextarea}
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder={isEn ? 'Record forensic evidence, containment steps, or post-mortem notes…' : 'Adli kanıtları, alınan tecrit aksiyonlarını veya analiz notlarını buraya kaydedin…'}
						disabled={!canManage || isSavingNotes}
					/>
					{canManage && (
						<button
							type="button"
							className={`${s.containmentBtn} ${s.containmentBtnPrimary}`}
							onClick={() => void handleSaveNotes()}
							disabled={isSavingNotes || isSubmitting}
							style={{ marginTop: 6 }}
						>
							<Check size={13} />
							<span>{isSavingNotes ? (isEn ? 'Saving…' : 'Kaydediliyor…') : (isEn ? 'Save Notes' : 'Notları Kaydet')}</span>
						</button>
					)}
				</div>

				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'SOAR Actions & Dossier' : 'SOAR & Adli Dosya'}</span>
					</div>
					<div className={s.actionGroup}>
						{canManage && inc.sourceIp && (
							<button
								type="button"
								className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
								onClick={() => void handleExecutePlaybook('brute-force-containment', { ip: inc.sourceIp || undefined })}
								disabled={isSubmitting}
							>
								<Flame size={13} />
								<span>{isEn ? 'Run Brute-Force Playbook' : 'Brute-Force Tecrit Playbook Çalıştır'}</span>
							</button>
						)}
						<button
							type="button"
							className={s.containmentBtn}
							onClick={() => void handleExportCaseDossier(inc.id)}
							disabled={isSubmitting}
						>
							<Download size={13} />
							<span>{isEn ? 'Export Case Dossier (SHA-256)' : 'Adli Vaka Dosyasını İndir (SHA-256)'}</span>
						</button>
					</div>
				</div>
			</>
		);
	};

	const renderSessionView = () => {
		if (inspectorEntity.type !== 'session') return null;
		const sess = inspectorEntity.data;

		return (
			<>
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'User Identity' : 'Kullanıcı Kimliği'}</span>
						<span className={`${s.badge} ${sess.admin ? s.badgeDanger : s.badgeNeutral}`}>
							{sess.admin ? 'ADMIN' : sess.rolAd || 'MEMBER'}
						</span>
					</div>
					<div className={s.gridProps}>
						<span className={s.propLabel}>{isEn ? 'Name' : 'Ad Soyad'}</span>
						<span className={s.propValue}>{sess.ad} {sess.soyad}</span>

						<span className={s.propLabel}>{isEn ? 'Email' : 'E-posta'}</span>
						<span className={s.propValue}>{sess.email}</span>

						<span className={s.propLabel}>{isEn ? 'User ID' : 'Kullanıcı ID'}</span>
						<span className={`${s.propValue} ${s.mono}`} data-type="user" data-value={sess.id}>
							{sess.id}
						</span>

						<span className={s.propLabel}>{isEn ? '2FA / TOTP' : '2FA Koruması'}</span>
						<span className={s.propValue}>
							{sess.totpEnabled ? (isEn ? 'Enabled (Active)' : 'Aktif (TOTP)') : (isEn ? 'Disabled' : 'Kapalı')}
						</span>
					</div>
				</div>

				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'Session Telemetry' : 'Oturum Ayrıntıları'}</span>
					</div>
					<div className={s.gridProps}>
						<span className={s.propLabel}>{isEn ? 'Client IP' : 'İstemci IP'}</span>
						<span className={`${s.propValue} ${s.mono}`} data-type="ip" data-value={sess.sonAktifIp || sess.sonGirisIp || ''}>
							{sess.sonAktifIp || sess.sonGirisIp || '—'}
						</span>

						<span className={s.propLabel}>{isEn ? 'User Agent' : 'Tarayıcı'}</span>
						<span className={s.propValue} title={sess.sonGirisUserAgent || ''}>
							{summarizeUa(sess.sonGirisUserAgent)}
						</span>

						<span className={s.propLabel}>{isEn ? 'Last Active' : 'Son İşlem'}</span>
						<span className={s.propValue}>{formatDateTime(sess.sonAktifTarihi, isEn ? 'en' : 'tr')}</span>
					</div>
				</div>

				{sess.impossibleTravel?.detected && (
					<div className={`${s.sectionCard}`} style={{ borderColor: 'var(--danger)' }}>
						<div className={s.sectionHeader}>
							<span style={{ color: 'var(--danger)' }}>{isEn ? 'Impossible Travel Alert' : 'İmkânsız Seyahat Uyarısı'}</span>
							<ShieldAlert size={14} color="var(--danger)" />
						</div>
						<p style={{ fontSize: 12, margin: 0, color: 'var(--text-secondary)' }}>
							{sess.impossibleTravel.reason || (isEn ? 'High-velocity geographic shift detected.' : 'Kısa sürede yüksek mesafeli IP değişimi tespit edildi.')}
						</p>
					</div>
				)}

				{canManage && (
					<div className={s.sectionCard}>
						<div className={s.sectionHeader}>
							<span>{isEn ? 'Shield & Containment' : 'Kalkan & Müdahale'}</span>
						</div>
						<div className={s.actionGroup}>
							<button
								type="button"
								className={`${s.containmentBtn} ${s.containmentBtnDanger}`}
								onClick={() => void handleKillSession(sess)}
								disabled={isSubmitting}
							>
								<Lock size={13} />
								<span>{isEn ? 'Terminate Active Session' : 'Oturumu Derhal Sonlandır'}</span>
							</button>

							<button
								type="button"
								className={s.containmentBtn}
								onClick={() => void handleKillUserTerminals(sess.id)}
								disabled={isSubmitting}
							>
								<Terminal size={13} />
								<span>{isEn ? 'Kill Active PTY Terminal Shells' : 'Aktif PTY Kabuklarını Kapat'}</span>
							</button>

							<button
								type="button"
								className={s.containmentBtn}
								onClick={() => openApp('members', { kind: 'member', itemId: sess.id })}
							>
								<ExternalLink size={13} />
								<span>{isEn ? 'Jump to Member Profile' : 'Üye Profiline Git (Uyeler)'}</span>
							</button>
						</div>
					</div>
				)}
			</>
		);
	};

	const renderFimView = () => {
		if (inspectorEntity.type !== 'fim') return null;
		const fim = inspectorEntity.data;

		return (
			<>
				<div className={s.sectionCard}>
					<div className={s.sectionHeader}>
						<span>{isEn ? 'File Integrity Profile' : 'Dosya Bütünlük Profili'}</span>
						<span className={`${s.badge} ${fim.match ? s.badgeDanger : s.badgeWarn}`}>
							{fim.match ? (isEn ? 'SUSPICIOUS' : 'ŞÜPHELİ') : (isEn ? 'TAMPERED' : 'DEĞİŞMİŞ')}
						</span>
					</div>
					<div className={s.gridProps}>
						<span className={s.propLabel}>{isEn ? 'Target File' : 'Dosya Yolu'}</span>
						<span className={`${s.propValue} ${s.mono}`} style={{ wordBreak: 'break-all' }}>
							{fim.file}
						</span>

						{fim.sha256 && (
							<>
								<span className={s.propLabel}>SHA-256</span>
								<span className={`${s.propValue} ${s.mono}`}>{fim.sha256.slice(0, 16)}…</span>
							</>
						)}

						{fim.match && (
							<>
								<span className={s.propLabel}>{isEn ? 'Matched Rule' : 'Eşleşen Kural'}</span>
								<span className={`${s.propValue} ${s.badge} ${s.badgeDanger}`}>
									{fim.match.matchedRule} (L#{fim.match.line})
								</span>
							</>
						)}
					</div>
				</div>

				{fimLoading ? (
					<div className={s.sectionCard}>
						<div style={{ fontSize: 12, opacity: 0.7, padding: '12px 0' }}>
							{isEn ? 'Analyzing git & disk diff hunks…' : 'Git ve disk fark blokları analiz ediliyor…'}
						</div>
					</div>
				) : (fim.diff || fimDiff) ? (
					<div className={s.sectionCard}>
						<div className={s.sectionHeader}>
							<span>{isEn ? 'Git Diff Snapshot' : 'Git Diff İncelemesi'}</span>
						</div>
						<pre className={s.codeViewer}>{fim.diff || fimDiff}</pre>
					</div>
				) : null}

				{fim.match?.snippet && (
					<div className={s.sectionCard}>
						<div className={s.sectionHeader}>
							<span>{isEn ? 'Detection Snippet' : 'Tespit Edilen Kod Parçası'}</span>
						</div>
						<pre className={s.codeViewer}>{fim.match.snippet}</pre>
					</div>
				)}
			</>
		);
	};

	// Determine header title and icon
	let title = 'Entity Forensics';
	let typeTag = 'INSPECTOR';
	let IconComp = Activity;

	if (inspectorEntity.type === 'event') {
		typeTag = isEn ? 'SIEM Log Event' : 'SIEM AppEvent Kaydı';
		title = `Log #${inspectorEntity.data.id} · ${inspectorEntity.data.servis}`;
		IconComp = FileText;
	} else if (inspectorEntity.type === 'ip') {
		typeTag = isEn ? 'IP Threat Profile' : 'IP Tehdit Profili';
		title = inspectorEntity.data.ip;
		IconComp = Globe;
	} else if (inspectorEntity.type === 'incident') {
		typeTag = isEn ? 'Security Incident' : 'Güvenlik AppEventı';
		title = inspectorEntity.data.title;
		IconComp = ShieldAlert;
	} else if (inspectorEntity.type === 'session') {
		typeTag = isEn ? 'Active Session' : 'Aktif Oturum';
		title = `${inspectorEntity.data.ad} ${inspectorEntity.data.soyad}`;
		IconComp = User;
	} else if (inspectorEntity.type === 'fim') {
		typeTag = isEn ? 'File Integrity' : 'Dosya Bütünlüğü';
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
						title={isEn ? 'Copy Entity JSON' : 'JSON Olarak Kopyala'}
					>
						{copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
					</button>
					<button
						type="button"
						className={s.iconBtn}
						onClick={closeInspector}
						title={isEn ? 'Close Inspector (Esc)' : 'Kapat (Esc)'}
					>
						<X size={15} />
					</button>
				</div>
			</div>

			<div className={s.inspectorBody}>
				{inspectorEntity.type === 'event' && renderEventView()}
				{inspectorEntity.type === 'ip' && renderIpView()}
				{inspectorEntity.type === 'incident' && renderIncidentView()}
				{inspectorEntity.type === 'session' && renderSessionView()}
				{inspectorEntity.type === 'fim' && renderFimView()}
			</div>
		</aside>
	);
}
