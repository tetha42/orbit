'use client';

import React, { useMemo } from 'react';
import {
	Ban,
	CheckCircle2,
	Flame,
	Activity,
	RefreshCw,
	EyeOff,
	Globe,
	AlertTriangle,
} from 'lucide-react';
import { useSoc } from '../../context/SocContext';
import { formatDateTime } from '../../types';
import { formatSocAlertMessage } from '../../utils/alertLocalization';
import s from '../../Soc.module.css';

export const FirewallView = React.memo(function FirewallView() {
	const {
		bans,
		overview,
		callerIp,
		canManage,
		isSubmitting,
		fwIp,
		setFwIp,
		fwMode,
		setFwMode,
		fwDuration,
		setFwDuration,
		fwReason,
		setFwReason,
		fwFilter,
		setFwFilter,
		handleFirewallSubmit,
		handleUnban,
		handleClearRateLimit,
		handleSelectDataOnDoubleClick,
		handleDataContainerDoubleClick,
		language,
		isEn,
		globalSearch,
	} = useSoc();

	const query = globalSearch.trim().toLowerCase();
	const filteredBans = useMemo(() => {
		return bans.filter((b) => {
			if (fwFilter !== 'all' && b.status !== fwFilter) return false;
			if (query) {
				return (
					b.ip.toLowerCase().includes(query) ||
					(b.neden && b.neden.toLowerCase().includes(query)) ||
					(b.status && b.status.toLowerCase().includes(query))
				);
			}
			return true;
		});
	}, [bans, fwFilter, query]);

	const activeBansOnlyCount = useMemo(() => bans.filter((b) => b.status === 'ban').length, [bans]);

	const filteredRateLimits = useMemo(() => {
		return (overview?.metrics.activeRateLimits ?? []).filter((rl) => {
			if (!query) return true;
			return rl.key.toLowerCase().includes(query);
		});
	}, [overview?.metrics.activeRateLimits, query]);

	return (
		<div className={s.viewContainer}>
			{/* Add Rule Form */}
			{canManage && (
				<section className={s.card}>
					<div className={s.cardHeader}>
						<div>
							<h2 className={s.cardTitle}>
								<Ban size={16} />
								{isEn ? 'Add Firewall Quarantine or Whitelist Rule' : 'Manuel IP Karantina veya Güvenilir Liste (Whitelist) Kuralı Ekle'}
							</h2>
							<p className={s.cardSub}>
								{isEn
									? `Your active IP (${callerIp || 'local'}) is protected from accidental self-ban.`
									: `Aktif yönetici IP adresiniz (${callerIp || 'yerel'}) oturum kilitleme koruması altındadır.`}
							</p>
						</div>
					</div>

					<form className={s.formRow} onSubmit={(e) => void handleFirewallSubmit(e)}>
						<input
							type="text"
							className={`${s.input} ${s.mono}`}
							placeholder={isEn ? 'IPv4, IPv6 or CIDR (e.g. 198.51.100.0/24)' : 'IPv4, IPv6 veya CIDR (örn. 198.51.100.0/24)'}
							value={fwIp}
							onChange={(e) => setFwIp(e.target.value)}
							required
						/>

						<select
							className={s.select}
							value={fwMode}
							onChange={(e) => setFwMode(e.target.value as 'ban' | 'whitelist')}
						>
							<option value="ban">{isEn ? 'Quarantine (Ban IP)' : 'Karantinaya Al (IP Engelle)'}</option>
							<option value="whitelist">{isEn ? 'Trusted IP (Whitelist)' : 'Güvenilir IP (Whitelist)'}</option>
						</select>

						{fwMode === 'ban' && (
							<select
								className={s.select}
								value={fwDuration}
								onChange={(e) => setFwDuration(e.target.value)}
							>
								<option value="15">{isEn ? '15 Minutes' : '15 Dakika'}</option>
								<option value="60">{isEn ? '1 Hour' : '1 Saat'}</option>
								<option value="120">{isEn ? '2 Hours' : '2 Saat'}</option>
								<option value="1440">{isEn ? '24 Hours' : '24 Saat'}</option>
								<option value="permanent">{isEn ? 'Permanent' : 'Kalıcı (Süresiz)'}</option>
							</select>
						)}

						<input
							type="text"
							className={`${s.input} ${s.inputGrow}`}
							placeholder={
								fwMode === 'ban'
									? isEn
										? 'Reason (e.g. Brute-force / SQLi scanner)'
										: 'Engelleme nedeni (örn. Brute-force / AI tarayıcı)'
									: isEn
									? 'Note (e.g. Lab static gateway IP)'
									: 'Açıklama (örn. Kulüp Laboratuvarı Statik IP)'
							}
							value={fwReason}
							onChange={(e) => setFwReason(e.target.value)}
						/>

						<button
							type="submit"
							className={`${s.actionBtn} ${fwMode === 'ban' ? s.actionBtnDanger : s.actionBtnPrimary}`}
							disabled={isSubmitting || !fwIp.trim()}
							style={{ padding: '8px 14px' }}
						>
							{fwMode === 'ban' ? <Ban size={14} /> : <CheckCircle2 size={14} />}
							<span>
								{fwMode === 'ban'
									? isEn
										? 'Block IP'
										: 'Karantinaya Al'
									: isEn
									? 'Add to Whitelist'
									: 'Whitelist Ekle'}
							</span>
						</button>
					</form>
				</section>
			)}

			{/* Active Rules List */}
			<section className={s.card}>
				<div className={s.cardHeader}>
					<div>
						<h2 className={s.cardTitle}>
							<Flame size={16} />
							{isEn ? 'Active Firewall & Quarantine Rules' : 'Aktif Güvenlik Duvarı & Karantina Listesi'}
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Enforced in real-time by the edge memory cache across all API routes'
								: 'Tüm API uç noktalarında bellek-içi önbellek ile milisaniye seviyesinde uygulanır'}
						</p>
					</div>

					<div className={s.formRow}>
						<button
							type="button"
							className={`${s.actionBtn} ${fwFilter === 'all' ? s.actionBtnPrimary : ''}`}
							onClick={() => setFwFilter('all')}
						>
							{isEn ? 'All' : 'Tümü'} ({bans.length})
						</button>
						<button
							type="button"
							className={`${s.actionBtn} ${fwFilter === 'ban' ? s.actionBtnDanger : ''}`}
							onClick={() => setFwFilter('ban')}
						>
							{isEn ? 'Quarantined' : 'Karantina'} ({activeBansOnlyCount})
						</button>
						<button
							type="button"
							className={`${s.actionBtn} ${fwFilter === 'whitelist' ? s.actionBtnPrimary : ''}`}
							onClick={() => setFwFilter('whitelist')}
						>
							Whitelist ({bans.length - activeBansOnlyCount})
						</button>
					</div>
				</div>

				{filteredBans.length === 0 ? (
					<div className={s.emptyState}>
						{isEn
							? 'No active firewall rules matching this filter.'
							: 'Bu filtreye uygun aktif güvenlik duvarı kuralı bulunmuyor.'}
					</div>
				) : (
					<div className={s.tableWrap} onDoubleClick={handleDataContainerDoubleClick}>
						<table className={s.table}>
							<thead>
								<tr>
									<th>IP</th>
									<th>{isEn ? 'Rule' : 'Kural Türü'}</th>
									<th>{isEn ? 'Score / Hits' : 'Puan / İhlal'}</th>
									<th>{isEn ? 'Reason' : 'Gerekçe'}</th>
									<th>{isEn ? 'Expires' : 'Bitiş Zamanı'}</th>
									<th>{isEn ? 'Updated' : 'Son Güncelleme'}</th>
									{canManage && <th>{isEn ? 'Action' : 'İşlem'}</th>}
								</tr>
							</thead>
							<tbody>
								{filteredBans.map((row) => (
									<tr key={row.ip}>
										<td className={s.mono}>
											<div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
												<span
													data-type="ip"
													className={s.selectableData}
													onDoubleClick={handleSelectDataOnDoubleClick}
													title={isEn ? 'Double-click to select IP' : 'IP adresini seçmek için çift tıklayın'}
												>
													{row.ip}
												</span>
												{(row.threatIntel?.isTorExitNode || row.threatIntel?.isTor) && (
													<span className={`${s.threatBadge} ${s.threatBadgeTor}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
														<EyeOff size={11} /> Tor
													</span>
												)}
												{(row.threatIntel?.isCloudHosting || row.threatIntel?.isDatacenter) && (
													<span className={`${s.threatBadge} ${s.threatBadgeCloud}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
														<Globe size={11} /> {row.threatIntel.provider || 'Cloud'}
													</span>
												)}
												{row.threatIntel?.riskLevel === 'HIGH' && (
													<span className={`${s.threatBadge} ${s.threatBadgeHigh}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
														<AlertTriangle size={11} /> {isEn ? 'High' : 'Yüksek'}
													</span>
												)}
											</div>
										</td>
										<td>
											{row.status === 'ban' ? (
												<span className={`${s.badge} ${s.badgeDanger}`}>
													<Ban size={11} />
													{isEn ? 'QUARANTINE' : 'KARANTİNA'}
												</span>
											) : (
												<span className={`${s.badge} ${s.badgeSuccess}`}>
													<CheckCircle2 size={11} />
													WHITELIST
												</span>
											)}
										</td>
										<td className={s.mono}>
											{row.status === 'ban' ? `${row.tehditPuani}p (${row.ihlaller}x)` : '0p'}
										</td>
										<td>
											<span
												data-type="reason"
												className={s.selectableData}
												onDoubleClick={handleSelectDataOnDoubleClick}
												title={isEn ? 'Double-click to select reason' : 'Gerekçeyi seçmek için çift tıklayın'}
											>
												{formatSocAlertMessage(row.neden, isEn)}
											</span>
										</td>
										<td>
											{row.status === 'whitelist'
												? isEn
													? 'Permanent'
													: 'Süresiz'
												: row.expiresAt
												? formatDateTime(row.expiresAt, language)
												: isEn
												? 'Permanent'
												: 'Kalıcı'}
										</td>
										<td>{formatDateTime(row.guncellenme, language)}</td>
										{canManage && (
											<td>
												<button
													type="button"
													className={s.actionBtn}
													onClick={() => void handleUnban(row.ip)}
													disabled={isSubmitting}
												>
													{isEn ? 'Remove Rule' : 'Kuralı Kaldır'}
												</button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* Active Rate Limits & Real-Time Throttles */}
			<section className={s.card}>
				<div className={s.cardHeader}>
					<div>
						<h2 className={s.cardTitle}>
							<Activity size={16} />
							{isEn ? 'Active Rate Limits & Real-Time Throttles' : 'Canlı Hız Sınırları & Bellek-İçi Kısıtlamalar'}
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'In-memory rate limit buckets for brute-force protection, SMTP tests, and sensitive API gates'
								: 'Brute-force, SMTP testleri ve kritik API rotaları için bellek-içi anlık limit sayaçları'}
						</p>
					</div>
				</div>

				{filteredRateLimits.length === 0 ? (
					<div className={s.emptyState}>
						{isEn
							? query
								? 'No throttled clients match your search query.'
								: 'No active rate limits or throttled clients at this moment.'
							: query
							? 'Arama kriterine uygun kilitlenmiş istemci bulunamadı.'
							: 'Şu anda hız sınırına takılan veya kilitlenen istemci bulunmuyor.'}
					</div>
				) : (
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
													style={{ padding: '6px 12px' }}
												>
													<RefreshCw size={12} />
													{isEn ? 'Reset Limit' : 'Hız Sınırını Sıfırla'}
												</button>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
});
