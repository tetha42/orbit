'use client';

import React, { useMemo } from 'react';
import {
	ShieldCheck,
	HardDrive,
	AlertCircle,
	CheckCircle2,
	AlertTriangle,
	ShieldAlert,
	Flame,
	Radio,
	Download,
	RefreshCw,
	Check,
	X,
	XCircle,
	Activity,
	GitCompare,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { FimDiffModal } from '../modals/FimDiffModal';
import s from '../../Soc.module.css';

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
		isEn,
	} = useSoc();

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
				{/* Sub-tab navigation */}
				<div className={s.subTabBar}>
					<button
						type="button"
						className={`${s.subTabBtn} ${inspectionSubTab === 'api' ? s.subTabBtnActive : ''}`}
						onClick={() => {
							setInspectionError(null);
							setInspectionSubTab('api');
						}}
					>
						<ShieldCheck size={14} />
						<span>{isEn ? 'API Security & Vulnerability Scanner' : 'API Güvenlik & Zafiyet Tarayıcısı'}</span>
						{appSecResult && (
							<span className={s.subTabBadge}>
								{appSecResult.passed}/{appSecResult.totalTested}
							</span>
						)}
					</button>

					<button
						type="button"
						className={`${s.subTabBtn} ${inspectionSubTab === 'fim' ? s.subTabBtnActive : ''}`}
						onClick={() => {
							setInspectionError(null);
							setInspectionSubTab('fim');
						}}
					>
						<HardDrive size={14} />
						<span>{isEn ? 'File Integrity (FIM) & Web Shell Hunter' : 'Dosya Bütünlüğü (FIM) & Web Shell Avcısı'}</span>
						{fimResult && (
							<span className={s.subTabBadge}>
								{fimResult.scannedFiles} {isEn ? 'files' : 'dosya'}
							</span>
						)}
					</button>
				</div>

				{/* Inline Error Card */}
				{inspectionError && (
					<div className={s.errorCard} style={{ margin: 16 }}>
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
					{/* SUB-PANEL 1: API Security Scanner */}
					{inspectionSubTab === 'api' && (
						<>
							<div className={s.inspectionBanner}>
								<div className={s.inspectionScoreCard}>
									<div
										className={`${s.scoreCircle} ${
											appSecResult?.grade === 'A+' || appSecResult?.grade === 'A'
												? s.scoreCircleA
												: appSecResult?.grade === 'B' || appSecResult?.grade === 'C'
												? s.scoreCircleB
												: s.scoreCircleF
										}`}
									>
										{appSecResult?.grade ?? 'A+'}
									</div>
									<div className={s.scoreInfo}>
										<h3>
											{isEn ? 'API Security & Authorization Matrix' : 'API Güvenlik & Permission Kalkanı Matrisi'}
											<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 8, opacity: 0.8 }}>
												({appSecResult ? `${appSecResult.score}/100` : '—'})
											</span>
										</h3>
										<p>
											{isEn
												? 'Zero-trust unauthenticated probe, WAF interception, and security headers check'
												: 'Sıfır-güven (unauthenticated) permission sızıntısı, WAF müdahale testi ve güvenlik başlıkları denetimi'}
										</p>
										<div style={{ marginTop: 8 }}>
											<span className={s.statTag}>
												<CheckCircle2 size={12} color="var(--success, #248a3d)" />
												{isEn ? 'Passed:' : 'Güvenli:'} {appSecResult?.passed ?? 0}
											</span>
											<span className={s.statTag}>
												<AlertTriangle size={12} color="var(--warning, #c45500)" />
												{isEn ? 'Warnings:' : 'Uyarı:'} {appSecResult?.warned ?? 0}
											</span>
											<span className={s.statTag}>
												<ShieldAlert size={12} color="var(--danger, #d70015)" />
												{isEn ? 'Vulnerabilities:' : 'Zafiyet:'} {appSecResult?.failed ?? 0}
											</span>
											<span className={s.statTag}>
												<Flame size={12} color="var(--danger, #d70015)" />
												{isEn ? 'WAF Guarded:' : 'WAF Kalkanı:'} {appSecResult?.wafActiveCount ?? 0}
											</span>
										</div>
										<div className={s.deceptionPillBar}>
											<span className={s.deceptionPill}>
												<ShieldCheck size={13} color="var(--success, #248a3d)" />
												<strong>{isEn ? 'AI & Bot Canary Fleet:' : 'AI & Bot Tuzak Filosu:'}</strong>
												<span>{isEn ? '15+ Active Decoys (Auto 100-pt Ban)' : '15+ Aktif Tuzak (Oto 100 Puan Karantina)'}</span>
											</span>
											<span className={s.deceptionPill} style={{ opacity: 0.85 }}>
												<Radio size={12} color="var(--accent, #0071e3)" />
												<span>.env · .git · wp-login · phpmyadmin · actuator · .aws</span>
											</span>
										</div>
									</div>
								</div>

								<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
									<button
										type="button"
										className={s.actionBtn}
										onClick={() => void handleDownloadAuditReport()}
										disabled={reportLoading}
										title={isEn ? 'Download complete AppSec report as Markdown' : 'Eksiksiz AppSec denetim raporunu Markdown olarak indir'}
									>
										<Download size={14} className={reportLoading ? s.spin : ''} />
										<span>
											{reportLoading
												? isEn
													? 'Generating Report...'
													: 'Rapor Hazırlanıyor...'
												: isEn
												? 'Export Audit Report (.md)'
												: 'Resmi Denetim Raporu İndir (.md)'}
										</span>
									</button>
									<button
										type="button"
										className={s.actionBtn}
										onClick={() => void handleTriggerApiScan()}
										disabled={inspectionLoading}
									>
										<RefreshCw size={14} className={inspectionLoading ? s.spin : ''} />
										<span>
											{inspectionLoading
												? isEn
													? 'Scanning Endpoints...'
													: 'Uç Noktalar Taranıyor...'
												: isEn
												? 'Run Live API Security Scan'
												: 'Canlı API Taraması Başlat'}
										</span>
									</button>
								</div>
							</div>

							{/* Filters and search */}
							<div className={s.formRow} style={{ marginBottom: 14 }}>
								<div className={s.filterGroup}>
									{[
										{ id: 'all', tr: 'Tümü', en: 'All' },
										{ id: 'auth', tr: 'Kimlik (Auth)', en: 'Auth' },
										{ id: 'public', tr: 'Genel (Public)', en: 'Public' },
										{ id: 'data', tr: 'Veri (Data)', en: 'Data' },
										{ id: 'terminal', tr: 'Terminal', en: 'Terminal' },
										{ id: 'soc', tr: 'SoC', en: 'SoC' },
										{ id: 'core', tr: 'Çekirdek (Core)', en: 'Core' },
									].map((cat) => {
										const count =
											cat.id === 'all'
												? appSecResult?.routes.length
												: appSecResult?.routes.filter((r) => r.category === cat.id).length;
										return (
											<button
												key={cat.id}
												type="button"
												className={`${s.filterBtn} ${apiFilterCategory === cat.id ? s.filterBtnActive : ''}`}
												onClick={() => setApiFilterCategory(cat.id)}
											>
												<span>{isEn ? cat.en : cat.tr}</span>
												{typeof count === 'number' && (
													<span
														style={{
															fontSize: 10,
															fontWeight: 700,
															marginLeft: 5,
															padding: '1px 5px',
															borderRadius: 999,
															background:
																apiFilterCategory === cat.id
																	? 'color-mix(in srgb, var(--accent) 15%, transparent)'
																	: 'var(--fill-soft, rgba(0, 0, 0, 0.08))',
														}}
													>
														{count}
													</span>
												)}
											</button>
										);
									})}
								</div>

								<input
									type="text"
									className={`${s.input} ${s.inputGrow}`}
									placeholder={isEn ? 'Filter endpoints (/api/...)' : 'Uç nokta ara (/api/...)'}
									value={apiSearch}
									onChange={(e) => setApiSearch(e.target.value)}
								/>
							</div>

							{/* Route security table */}
							<div className={s.tableContainer} onDoubleClick={handleDataContainerDoubleClick}>
								<table className={s.table}>
									<thead>
										<tr>
											<th>{isEn ? 'Endpoint' : 'Uç Nokta'}</th>
											<th>{isEn ? 'Category' : 'Kategori'}</th>
											<th>{isEn ? 'Auth Barrier' : 'Permission Kalkanı'}</th>
											<th>{isEn ? 'WAF Intercept' : 'WAF Müdahalesi'}</th>
											<th>{isEn ? 'Security Headers' : 'Güvenlik Başlıkları'}</th>
											<th>{isEn ? 'Status' : 'Durum'}</th>
											<th>{isEn ? 'Latency' : 'Gecikme'}</th>
											<th style={{ textAlign: 'right' }}>{isEn ? 'Action' : 'Eylem'}</th>
										</tr>
									</thead>
									<tbody>
										{filteredRoutes.map((r) => (
												<tr key={r.endpoint}>
													<td className={s.mono} style={{ fontWeight: 600 }}>
														<span
															data-type="endpoint"
															className={s.selectableData}
															onDoubleClick={handleSelectDataOnDoubleClick}
															title={isEn ? 'Double-click to select endpoint' : 'Uç noktayı seçmek için çift tıklayın'}
														>
															{r.endpoint}
														</span>
													</td>
													<td>
														<span className={s.statTag}>{r.category}</span>
													</td>
													<td>
														{r.isPublicExpected ? (
															<span className={s.statTag} style={{ opacity: 0.85 }}>
																{isEn ? 'Public Endpoint' : 'Genel Açık'}
															</span>
														) : r.authGuarded || [401, 403, 404].includes(r.unauthStatus) ? (
															<span className={s.badgePass}>
																<Check size={11} />
																HTTP {r.unauthStatus} ({isEn ? 'Guarded' : 'Korumalı'})
															</span>
														) : r.unauthStatus === 0 ? (
															<span className={s.badgeWarn}>
																<AlertTriangle size={11} />
																{isEn ? 'Probe Failed (HTTP 0)' : 'Ulaşılamadı (HTTP 0)'}
															</span>
														) : (
															<span className={s.badgeFail}>
																<XCircle size={11} />
																HTTP {r.unauthStatus} ({isEn ? 'Exposed!' : 'Açık!'})
															</span>
														)}
													</td>
													<td>
														{r.wafIntercepted ? (
															<span className={s.badgePass}>
																<Flame size={11} />
																HTTP 403 (WAF Engelledi)
															</span>
														) : (
															<span className={s.statTag}>
																HTTP {r.wafStatus || '—'}
															</span>
														)}
													</td>
													<td>
														<span style={{ fontSize: 11, fontFamily: 'monospace' }}>
															{r.headers.csp ? 'CSP ' : ''}
															{r.headers.xFrameOptions ? 'X-Frame ' : ''}
															{r.headers.xContentTypeOptions ? 'X-Content' : ''}
															{!r.hasSecurityHeaders && '—'}
														</span>
													</td>
													<td>
														<span
															className={
																r.status === 'PASS'
																	? s.badgePass
																	: r.status === 'WARN'
																	? s.badgeWarn
																	: s.badgeFail
															}
														>
															{r.status}
														</span>
													</td>
													<td style={{ fontSize: 11.5, opacity: 0.7 }}>
														{r.latencyMs} ms
													</td>
													<td style={{ textAlign: 'right' }}>
														<button
															type="button"
															className={s.actionBtn}
															style={{ padding: '3px 8px', fontSize: 11, minHeight: 24, gap: 4 }}
															disabled={probingEndpoint === r.endpoint}
															onClick={() => void handleProbeSingleRoute(r.endpoint)}
															title={isEn ? 'Probe route live' : 'Rotayı canlı sına'}
														>
															<Activity size={11} className={probingEndpoint === r.endpoint ? s.spin : ''} />
															<span>
																{probingEndpoint === r.endpoint
																	? isEn
																		? 'Probing...'
																		: 'Sınanıyor...'
																	: isEn
																	? 'Probe'
																	: 'Sına'}
															</span>
														</button>
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						</>
					)}

					{/* SUB-PANEL 2: FIM & Web Shell Hunter */}
					{inspectionSubTab === 'fim' && (
						<>
							<div className={s.inspectionBanner}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
									<label style={{ fontSize: 12.5, fontWeight: 600 }}>
										{isEn ? 'Target Directory:' : 'Hedef Dizin:'}
									</label>
									<select
										className={s.select}
										value={fimTarget}
										onChange={(e) => handleTargetChange(e.target.value)}
										disabled={inspectionLoading}
									>
										<option value="repo">
											{isEn ? 'Repository Sources (src/, scripts/, configs/)' : 'Repo Kaynak Kodları (src/, scripts/, configs/)'}
										</option>
										<option value="uploads">
											{isEn ? 'User Uploads (data/uploads/)' : 'Kullanıcı Yüklemeleri (data/uploads/)'}
										</option>
										<option value="tmp">
											{isEn ? 'Temporary Linux Directory (/tmp/)' : 'Geçici Linux Dizini (/tmp/)'}
										</option>
									</select>
								</div>

								<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
									<button
										type="button"
										className={s.actionBtn}
										onClick={() => void handleTriggerFimScan()}
										disabled={inspectionLoading}
									>
										<RefreshCw size={14} className={inspectionLoading ? s.spin : ''} />
										<span>
											{inspectionLoading
												? isEn
													? 'Scanning Filesystem...'
													: 'Dosya Sistemi Taranıyor...'
												: isEn
												? 'Scan Files & Web Shells'
												: 'Sistemi ve Kodları Tara'}
										</span>
									</button>

									{canManage && (
										<button
											type="button"
											className={s.actionBtn}
											onClick={() => void handleCreateBaseline()}
											disabled={inspectionLoading}
											title={isEn ? 'Save current state as SHA-256 integrity baseline' : 'Mevcut durumu güvenilir referans profili olarak kaydet'}
										>
											<CheckCircle2 size={14} />
											<span>{isEn ? 'Save Baseline' : 'Başlangıç Profili Oluştur'}</span>
										</button>
									)}
								</div>
							</div>

							{/* Metrics Cards */}
							<div className={s.fimGrid}>
								<div className={s.fimMetricCard}>
									<span className={s.fimMetricLabel}>{isEn ? 'Scanned Files' : 'Taranan Dosya'}</span>
									<span className={s.fimMetricVal}>{fimResult?.scannedFiles ?? 0}</span>
								</div>
								<div className={s.fimMetricCard}>
									<span className={s.fimMetricLabel}>{isEn ? 'Scan Duration' : 'Tarama Süresi'}</span>
									<span className={s.fimMetricVal}>{fimResult?.durationMs ?? 0} ms</span>
								</div>
								<div className={s.fimMetricCard}>
									<span className={s.fimMetricLabel}>{isEn ? 'Suspicious Files (Web Shells)' : 'Şüpheli Web Shell / Arka Kapı'}</span>
									<span
										className={s.fimMetricVal}
										style={{ color: (fimResult?.suspiciousFiles?.length ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}
									>
										{fimResult?.suspiciousFiles?.length ?? 0}
									</span>
								</div>
								<div className={s.fimMetricCard}>
									<span className={s.fimMetricLabel}>{isEn ? 'Integrity Deviations' : 'Hash Bütünlük Anomalisi'}</span>
									<span
										className={s.fimMetricVal}
										style={{ color: (fimResult?.anomalies?.length ?? 0) > 0 ? 'var(--warning)' : 'var(--text-primary)' }}
									>
										{fimResult?.anomalies?.length ?? 0}
									</span>
								</div>
							</div>

							{/* Suspicious Files Display */}
							{fimResult?.suspiciousFiles && fimResult.suspiciousFiles.length > 0 ? (
								<div className={s.suspiciousBox}>
									<div className={s.suspiciousBoxTitle}>
										<AlertTriangle size={18} />
										<span>
											{isEn
												? `CRITICAL ALERT: ${fimResult.suspiciousFiles.length} Suspicious File(s) or Backdoors Detected!`
												: `KRİTİK ALARM: ${fimResult.suspiciousFiles.length} Adet Şüpheli Web Shell veya Arka Kapı İzi Tespit Edildi!`}
										</span>
									</div>
									{fimResult.suspiciousFiles.map((sf, idx) => (
										<div
											key={`${sf.path}-${sf.line}-${idx}`}
											className={s.suspiciousItem}
											onClick={() => openInspector({ type: 'fim', data: { file: sf.path, match: sf } })}
											style={{ cursor: 'pointer' }}
											title={isEn ? 'Click to inspect in 3-pane inspector' : '3 panelli teftiş ekranında açmak için tıklayın'}
										>
											<div className={s.suspiciousItemHeader}>
												<span className={s.suspiciousItemPath}>{sf.path}:{sf.line}</span>
												<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
													<span className={s.badgeFail}>{sf.matchedRule}</span>
													<span className={s.badgeFail}>{sf.severity}</span>
												</div>
											</div>
											<pre className={s.codeSnippet}>{sf.snippet}</pre>
										</div>
									))}
								</div>
							) : (
								<div className={s.cleanState}>
									<ShieldCheck size={20} />
									<div>
										<strong>{isEn ? 'Heuristic Scanner Clean' : 'Heuristic Tarama Temiz'}</strong>
										<div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>
											{isEn
												? 'No eval/base64 obfuscation, reverse shell sockets, or suspicious file writes detected.'
												: 'Hiçbir gizlenmiş eval, base64 çalıştırma, ters bağlantı veya yetkisiz dosya yazma izine rastlanmadı.'}
										</div>
									</div>
								</div>
							)}

							{/* Anomalies Diff Display */}
							{fimResult?.anomalies && fimResult.anomalies.length > 0 ? (
								<div style={{ marginTop: 16 }}>
									<h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>
										{isEn ? 'Integrity Baseline Deviations' : 'Dosya Bütünlüğü Sapmaları (Baseline Farkı)'}
									</h4>
									<div className={s.tableContainer} onDoubleClick={handleDataContainerDoubleClick}>
										<table className={s.table}>
											<thead>
												<tr>
													<th>{isEn ? 'Action Type' : 'İşlem Tipi'}</th>
													<th>{isEn ? 'File Path' : 'Dosya Yolu'}</th>
													<th>{isEn ? 'Baseline SHA-256' : 'Referans Hash'}</th>
													<th>{isEn ? 'Current SHA-256' : 'Mevcut Hash'}</th>
													<th>{isEn ? 'Actions' : 'İşlem'}</th>
												</tr>
											</thead>
											<tbody>
												{fimResult.anomalies.map((an, idx) => (
													<tr
														key={`${an.path}-${idx}`}
														onClick={() => openInspector({ type: 'fim', data: { file: an.path, sha256: an.newHash || an.oldHash, anomaly: an } })}
														style={{ cursor: 'pointer' }}
														title={isEn ? 'Click to inspect in 3-pane inspector' : '3 panelli teftiş ekranında açmak için tıklayın'}
													>
														<td>
															<span
																className={
																	an.type === 'modified'
																		? s.badgeWarn
																		: an.type === 'added'
																		? s.badgeFail
																		: s.statTag
																}
															>
																{an.type.toUpperCase()}
															</span>
														</td>
														<td className={s.mono} style={{ fontSize: 12 }}>
															<span
																data-type="path"
																className={s.selectableData}
																onDoubleClick={handleSelectDataOnDoubleClick}
																title={isEn ? 'Double-click to select file path' : 'Dosya yolunu seçmek için çift tıklayın'}
															>
																{an.path}
															</span>
														</td>
														<td className={s.mono} style={{ fontSize: 11, opacity: 0.7 }}>
															<span
																data-type="hash"
																className={s.selectableData}
																onDoubleClick={handleSelectDataOnDoubleClick}
																title={an.oldHash || undefined}
															>
																{an.oldHash ? `${an.oldHash.slice(0, 16)}…` : '—'}
															</span>
														</td>
														<td className={s.mono} style={{ fontSize: 11, opacity: 0.7 }}>
															<span
																data-type="hash"
																className={s.selectableData}
																onDoubleClick={handleSelectDataOnDoubleClick}
																title={an.newHash || undefined}
															>
																{an.newHash ? `${an.newHash.slice(0, 16)}…` : '—'}
															</span>
														</td>
														<td>
															<button
																type="button"
																className={s.actionBtn}
																style={{ height: 24, padding: '0 8px', fontSize: 11 }}
																onClick={(e) => {
																	e.stopPropagation();
																	setDiffModalFile(an.path);
																}}
															>
																<GitCompare size={12} />
																<span>{isEn ? 'Diff' : 'Fark'}</span>
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							) : (
								<div className={s.cleanState}>
									<CheckCircle2 size={20} />
									<div>
										<strong>{isEn ? 'Integrity Baseline Verified' : 'Bütünlük Profili Onaylandı'}</strong>
										<div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>
											{isEn
												? 'All scanned files match their SHA-256 baseline hashes without unexpected additions or alterations.'
												: 'Taranan tüm dosyalar güvenilir SHA-256 referans profiliyle %100 örtüşüyor.'}
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</section>

			{diffModalFile && (
				<FimDiffModal filePath={diffModalFile} onClose={() => setDiffModalFile(null)} />
			)}
		</div>
	);
});
