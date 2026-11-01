'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
	History,
	Activity,
	RotateCcw,
	Download,
	Trash2,
	Search,
	X,
	ChevronLeft,
	ChevronRight,
	PlusCircle,
	Sliders,
	Trash,
	ShieldAlert,
	Copy,
	Check,
	Eye,
	ArrowRight,
	FileText,
	Code2,
	ExternalLink,
	Shield,
} from 'lucide-react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { downloadCsv } from '@/core/data/download';
import { formatDateTime } from '@/core/data/format';
import { useToast } from '@/core/ui/Toast';
import { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { copyToClipboard } from '@/lib/clipboard';
import {
	AUDIT_CSV_HEADERS,
	AUDIT_PAGE_SIZE,
	AUDIT_ACTIONS,
	auditCsvRows,
	formatAuditAction,
	diffRows,
	type AuditRecord,
	type DiffRow,
} from '@/lib/audit';
import { fill } from '@/lib/text';
import { Sheet } from '@/core/ui/Sheet';
import { isPermissionApp, PERMISSION_DESCRIPTIONS } from '@/core/permissions';
import { getAppMeta } from '@/configs/apps.config';
import type { AppID } from '@/types/workspace';
import { useSoc } from '../../context/SocContext';
import s from './SocAuditView.module.css';

interface AuditResponse {
	kayitlar: AuditRecord[];
	toplam: number;
	sayfa: number;
	boyut: number;
}

type CategoryType = 'all' | 'roles' | 'members' | 'security';
type DatePresetType = 'all' | 'today' | '7d' | '30d' | 'custom';

function getActionCategory(islem: string): 'roles' | 'members' | 'security' {
	if (islem.startsWith('role.') || islem.startsWith('rol_')) return 'roles';
	if (islem.startsWith('uye.') || islem.startsWith('basvuru.')) return 'members';
	return 'security';
}

function getActionTone(islem: string): 'create' | 'update' | 'delete' | 'security' {
	if (
		islem.includes('olustur') ||
		islem.includes('ata') ||
		islem.includes('onayla') ||
		islem.includes('aktif') ||
		islem.includes('create')
	) {
		return 'create';
	}
	if (
		islem.includes('sil') ||
		islem.includes('kaldir') ||
		islem.includes('reddet') ||
		islem.includes('kapat') ||
		islem.includes('delete')
	) {
		return 'delete';
	}
	if (
		islem.includes('2fa') ||
		islem.includes('smtp') ||
		islem.includes('guvenlik') ||
		islem.includes('sifre')
	) {
		return 'security';
	}
	return 'update';
}

function formatRelativeTime(timestamp: number, isEn: boolean): string {
	const now = Date.now();
	const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
	if (diffSec < 60) return isEn ? 'Just now' : 'Az önce';
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin}dk önce`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return isEn ? `${diffHours}h ago` : `${diffHours}sa önce`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) return isEn ? `${diffDays}d ago` : `${diffDays}g önce`;
	return new Date(timestamp).toLocaleDateString(isEn ? 'en-US' : 'tr-TR', {
		month: 'short',
		day: 'numeric',
	});
}

function getDiffSummary(record: AuditRecord, t: (k: string, f?: string) => string, isEn: boolean): string | null {
	const diffs = diffRows(record.onceki, record.sonraki);
	if (!diffs || diffs.length === 0) return null;

	const roleDiff = diffs.find((d) => d.alan === 'roleId' || d.alan === 'rolAd');
	if (roleDiff) {
		const newVal = String(roleDiff.sonraki || '—');
		return isEn ? `Role: ${newVal}` : `Rol: ${newVal}`;
	}

	const permDiffs = diffs.filter((d) => d.alan.startsWith('izinler.'));
	if (permDiffs.length > 0) {
		return isEn ? `${permDiffs.length} perm changes` : `${permDiffs.length} yetki değişti`;
	}

	if (diffs.length === 1) {
		const fieldName = t(`auditField_${diffs[0].alan}`, diffs[0].alan);
		return isEn ? `${fieldName} updated` : `${fieldName} güncellendi`;
	}

	return isEn ? `${diffs.length} fields modified` : `${diffs.length} alan değişti`;
}

export function SocAuditView() {
	const { t, language } = useI18n();
	const isEn = language === 'en';
	const notify = useToast();
	const dialog = useDialog();

	// SOC context integrations
	const { canManage, setSiemIp, setSiemIpOp, setActiveTab } = useSoc();

	// Roles list
	const [roles, setRoles] = useState<{ id: string; ad: string }[]>([]);

	useEffect(() => {
		let cancelled = false;
		fetch('/api/roles', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (!cancelled && Array.isArray(payload?.roller)) setRoles(payload.roller);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	// Filter states
	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
	const [selectedRole, setSelectedRole] = useState('');
	const [selectedAction, setSelectedAction] = useState('');
	const [datePreset, setDatePreset] = useState<DatePresetType>('all');
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const [currentPage, setCurrentPage] = useState(1);

	// Debounce search
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const handleSearchChange = (val: string) => {
		setSearchQuery(val);
		if (searchTimer.current) clearTimeout(searchTimer.current);
		searchTimer.current = setTimeout(() => {
			setDebouncedSearch(val.trim());
			setCurrentPage(1);
		}, 280);
	};

	const handleCategoryChange = (cat: CategoryType) => {
		setActiveCategory(cat);
		setSelectedAction('');
		setCurrentPage(1);
	};

	const handleDatePreset = (preset: DatePresetType) => {
		setDatePreset(preset);
		const today = new Date();
		const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

		if (preset === 'all') {
			setFromDate('');
			setToDate('');
		} else if (preset === 'today') {
			const str = formatDateStr(today);
			setFromDate(str);
			setToDate(str);
		} else if (preset === '7d') {
			const past = new Date(Date.now() - 7 * 86400000);
			setFromDate(formatDateStr(past));
			setToDate(formatDateStr(today));
		} else if (preset === '30d') {
			const past = new Date(Date.now() - 30 * 86400000);
			setFromDate(formatDateStr(past));
			setToDate(formatDateStr(today));
		}
		setCurrentPage(1);
	};

	const resetAllFilters = () => {
		setSearchQuery('');
		setDebouncedSearch('');
		setActiveCategory('all');
		setSelectedRole('');
		setSelectedAction('');
		setDatePreset('all');
		setFromDate('');
		setToDate('');
		setCurrentPage(1);
	};

	const hasActiveFilters = Boolean(
		debouncedSearch ||
		activeCategory !== 'all' ||
		selectedRole ||
		selectedAction ||
		fromDate ||
		toDate
	);

	// Construct query URL
	const queryUrl = useMemo(() => {
		const p = new URLSearchParams();
		if (debouncedSearch) p.set('kisi', debouncedSearch);
		if (selectedRole) p.set('role', selectedRole);
		if (selectedAction) {
			p.set('islem', selectedAction);
		}
		if (fromDate) p.set('from', fromDate);
		if (toDate) p.set('to', toDate);
		if (currentPage > 1) p.set('sayfa', String(currentPage));
		return `/api/audit?${p.toString()}`;
	}, [debouncedSearch, selectedRole, selectedAction, fromDate, toDate, currentPage]);

	// Fetch records
	const { data, refetch, isLoading, error } = useJsonResource<AuditResponse>(queryUrl);

	// Filter by Category locally if specific action not selected
	const filteredRecords = useMemo(() => {
		const list = data?.kayitlar ?? [];
		if (activeCategory === 'all' || selectedAction) return list;
		return list.filter((r) => getActionCategory(r.islem) === activeCategory);
	}, [data?.kayitlar, activeCategory, selectedAction]);

	const totalRecords = data?.toplam ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalRecords / AUDIT_PAGE_SIZE));

	// Action states
	const [exporting, setExporting] = useState(false);
	const [clearing, setClearing] = useState(false);
	const [inspectRecord, setInspectRecord] = useState<AuditRecord | null>(null);

	// CSV Export
	const exportAuditCsv = async () => {
		setExporting(true);
		try {
			const p = new URLSearchParams();
			if (debouncedSearch) p.set('kisi', debouncedSearch);
			if (selectedRole) p.set('role', selectedRole);
			if (selectedAction) p.set('islem', selectedAction);
			if (fromDate) p.set('from', fromDate);
			if (toDate) p.set('to', toDate);
			p.set('tum', '1');

			const res = await fetch(`/api/audit?${p.toString()}`);
			if (!res.ok) throw new Error();
			const json = (await res.json()) as AuditResponse;
			const rows = auditCsvRows(json.kayitlar);
			downloadCsv(`soc-audit-log-${new Date().toISOString().slice(0, 10)}`, AUDIT_CSV_HEADERS, rows);
			notify(isEn ? 'Audit log exported as CSV.' : 'Denetim günlüğü CSV olarak indirildi.', 'success');
		} catch {
			notify(t('auditCsvHata'), 'error');
		} finally {
			setExporting(false);
		}
	};

	// Clear / Purge History
	const purgeAuditLog = async () => {
		const approved = await dialog.confirm({
			title: t('auditTemizle'),
			message: t('auditTemizleOnay'),
			tone: 'danger',
			confirmLabel: t('auditTemizle'),
		});
		if (!approved) return;

		setClearing(true);
		try {
			const res = await fetch('/api/audit', { method: 'DELETE' });
			if (!res.ok) throw new Error();
			notify(t('auditTemizlendi'), 'success');
			await refetch();
		} catch {
			notify(t('auditHata'), 'error');
		} finally {
			setClearing(false);
		}
	};

	// Pivot to SIEM
	const handlePivotToSiem = useCallback(
		(ip: string) => {
			setSiemIp(ip);
			setSiemIpOp?.('eq');
			setActiveTab('siem');
			setInspectRecord(null);
		},
		[setSiemIp, setSiemIpOp, setActiveTab]
	);

	// Filter actions by category for dropdown
	const availableActions = useMemo(() => {
		if (activeCategory === 'all') return AUDIT_ACTIONS;
		return AUDIT_ACTIONS.filter((a) => getActionCategory(a) === activeCategory);
	}, [activeCategory]);

	return (
		<div className={s.auditContainer}>
			<section className={s.card}>
				{/* Card Header with Telemetry Badges & Primary Actions */}
				<div className={s.cardHeader}>
					<div className={s.headerLeft}>
						<h2 className={s.cardTitle}>
							<History size={16} />
							<span>{isEn ? 'Change History & Security Audit' : 'Değişiklik Geçmişi & Güvenlik Denetimi'}</span>
						</h2>
						<p className={s.cardSub}>
							{isEn
								? 'Immutable, zero-trust audit trail of role permission mutations, lifecycle events, and administrative actions'
								: 'Yönetimsel yetki değişiklikleri, rol atamaları ve üye yaşam döngüsünün adli denetim kayıtları'}
						</p>
					</div>

					<div className={s.headerActions}>
						<span className={s.countBadge}>
							<Activity size={12} />
							<span>{fill(isEn ? '{n} Events' : '{n} Olay', { n: totalRecords, count: totalRecords })}</span>
						</span>

						<button
							type="button"
							className={s.actionBtn}
							onClick={() => void refetch()}
							disabled={isLoading}
							title={isEn ? 'Refresh log' : 'Kayıtları yenile'}
						>
							<RotateCcw size={13} className={isLoading ? s.spin : ''} />
							<span>{isEn ? 'Refresh' : 'Yenile'}</span>
						</button>

						<button
							type="button"
							className={s.actionBtn}
							onClick={exportAuditCsv}
							disabled={exporting || totalRecords === 0}
							title={t('auditCsvIndir')}
						>
							<Download size={13} />
							<span>{exporting ? (isEn ? 'Exporting…' : 'İndiriliyor…') : 'CSV'}</span>
						</button>

						{canManage && (
							<button
								type="button"
								className={`${s.actionBtn} ${s.actionBtnDanger}`}
								onClick={purgeAuditLog}
								disabled={clearing || totalRecords === 0}
								title={t('auditTemizle')}
							>
								<Trash2 size={13} />
								<span>{isEn ? 'Clear Log' : 'Temizle'}</span>
							</button>
						)}
					</div>
				</div>

				{/* Omnibar & Responsive Filter Section */}
				<div className={s.filterSection}>
					{/* Primary Row: Live Search & Category Pills */}
					<div className={s.filterRowMain}>
						<div className={s.searchWrap}>
							<Search size={14} className={s.searchIcon} />
							<input
								type="text"
								className={s.searchInput}
								placeholder={
									isEn
										? 'Filter by actor, target, action or IP address…'
										: 'Yapan, hedef, işlem veya IP adresi ara…'
								}
								value={searchQuery}
								onChange={(e) => handleSearchChange(e.target.value)}
								aria-label={t('auditFiltreKisi')}
							/>
							{searchQuery && (
								<button
									type="button"
									className={s.clearSearchBtn}
									onClick={() => {
										setSearchQuery('');
										setDebouncedSearch('');
										setCurrentPage(1);
									}}
									title={isEn ? 'Clear search' : 'Aramayı temizle'}
								>
									<X size={12} />
								</button>
							)}
						</div>

						<div className={s.categoryPills}>
							<button
								type="button"
								className={`${s.categoryBtn} ${activeCategory === 'all' ? s.categoryBtnActive : ''}`}
								onClick={() => handleCategoryChange('all')}
							>
								{isEn ? 'All' : 'Tümü'}
							</button>
							<button
								type="button"
								className={`${s.categoryBtn} ${activeCategory === 'roles' ? s.categoryBtnActive : ''}`}
								onClick={() => handleCategoryChange('roles')}
							>
								<Sliders size={12} />
								<span>{isEn ? 'Roles & Perms' : 'Rol & Yetkiler'}</span>
							</button>
							<button
								type="button"
								className={`${s.categoryBtn} ${activeCategory === 'members' ? s.categoryBtnActive : ''}`}
								onClick={() => handleCategoryChange('members')}
							>
								{isEn ? 'Members' : 'Üyeler'}
							</button>
							<button
								type="button"
								className={`${s.categoryBtn} ${activeCategory === 'security' ? s.categoryBtnActive : ''}`}
								onClick={() => handleCategoryChange('security')}
							>
								<Shield size={12} />
								<span>{isEn ? 'Security & System' : 'Güvenlik & Sistem'}</span>
							</button>
						</div>
					</div>

					{/* Secondary Row: Granular Selects & Responsive Date Presets */}
					<div className={s.filterRowSecondary}>
						<select
							className={s.selectInput}
							value={selectedRole}
							onChange={(e) => {
								setSelectedRole(e.target.value);
								setCurrentPage(1);
							}}
							aria-label={t('auditFiltreRol')}
						>
							<option value="">{t('auditFiltreRolHepsi')}</option>
							{roles.map((r) => (
								<option key={r.id} value={r.id}>
									{r.ad}
								</option>
							))}
						</select>

						<select
							className={s.selectInput}
							value={selectedAction}
							onChange={(e) => {
								setSelectedAction(e.target.value);
								setCurrentPage(1);
							}}
							aria-label={t('auditFiltreIslem')}
						>
							<option value="">{t('auditFiltreIslemHepsi')}</option>
							{availableActions.map((op) => (
								<option key={op} value={op}>
									{formatAuditAction(op, t)}
								</option>
							))}
						</select>

						{/* Quick Date Presets */}
						<div className={s.datePresetGroup}>
							<button
								type="button"
								className={`${s.datePresetBtn} ${datePreset === 'all' ? s.datePresetBtnActive : ''}`}
								onClick={() => handleDatePreset('all')}
							>
								{isEn ? 'All Time' : 'Tümü'}
							</button>
							<button
								type="button"
								className={`${s.datePresetBtn} ${datePreset === 'today' ? s.datePresetBtnActive : ''}`}
								onClick={() => handleDatePreset('today')}
							>
								{isEn ? 'Today' : 'Bugün'}
							</button>
							<button
								type="button"
								className={`${s.datePresetBtn} ${datePreset === '7d' ? s.datePresetBtnActive : ''}`}
								onClick={() => handleDatePreset('7d')}
							>
								{isEn ? '7 Days' : '7 Gün'}
							</button>
							<button
								type="button"
								className={`${s.datePresetBtn} ${datePreset === '30d' ? s.datePresetBtnActive : ''}`}
								onClick={() => handleDatePreset('30d')}
							>
								{isEn ? '30 Days' : '30 Gün'}
							</button>
						</div>

						{/* Responsive Date Range Inputs */}
						<div className={s.dateRangeCustom}>
							<input
								type="date"
								className={s.dateInput}
								value={fromDate}
								onChange={(e) => {
									setFromDate(e.target.value);
									setDatePreset('custom');
									setCurrentPage(1);
								}}
								aria-label={t('auditFiltreBaslangic')}
								title={t('auditFiltreBaslangic')}
							/>
							<span className={s.dateSep}>—</span>
							<input
								type="date"
								className={s.dateInput}
								value={toDate}
								onChange={(e) => {
									setToDate(e.target.value);
									setDatePreset('custom');
									setCurrentPage(1);
								}}
								aria-label={t('auditFiltreBitis')}
								title={t('auditFiltreBitis')}
							/>
						</div>

						{hasActiveFilters && (
							<button
								type="button"
								className={s.resetFilterBtn}
								onClick={resetAllFilters}
								title={t('auditFiltreTemizle')}
							>
								<X size={12} />
								<span>{t('auditFiltreTemizle')}</span>
							</button>
						)}
					</div>
				</div>

				{/* Error Notification */}
				{error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{t('auditHata')}</div>}

				{/* Empty State */}
				{filteredRecords.length === 0 && (
					<div className={s.emptyState}>
						<History size={32} style={{ opacity: 0.3 }} />
						<span>{data ? t('auditBos') : t('auditLoading')}</span>
					</div>
				)}

				{/* ========================================================= */}
				{/* 1. Desktop High-Density Table                             */}
				{/* ========================================================= */}
				{filteredRecords.length > 0 && (
					<div className={s.desktopTableWrap}>
						<table className={s.auditTable}>
							<thead>
								<tr>
									<th>{isEn ? 'Action / Event' : 'İşlem / Olay'}</th>
									<th>{t('auditYapan')}</th>
									<th>{t('auditHedef')}</th>
									<th>{isEn ? 'Diff Summary' : 'Değişiklik Özeti'}</th>
									<th>{t('auditIp')}</th>
									<th>{t('auditZaman')}</th>
									<th style={{ textAlign: 'right' }}>{isEn ? 'Inspect' : 'İncele'}</th>
								</tr>
							</thead>
							<tbody>
								{filteredRecords.map((record) => {
									const tone = getActionTone(record.islem);
									const toneClass =
										tone === 'create'
											? s.badgeCreate
											: tone === 'delete'
											? s.badgeDelete
											: tone === 'security'
											? s.badgeSecurity
											: s.badgeUpdate;

									const actionIcon =
										tone === 'create' ? (
											<PlusCircle size={11} />
										) : tone === 'delete' ? (
											<Trash size={11} />
										) : tone === 'security' ? (
											<ShieldAlert size={11} />
										) : (
											<Sliders size={11} />
										);

									const diffSummary = getDiffSummary(record, t, isEn);
									const actorName = record.yapanAd || record.yapanId || 'System';
									const targetName = record.hedefAd || record.hedefId || '—';

									return (
										<tr
											key={record.id}
											className={s.auditTableRow}
											onClick={() => setInspectRecord(record)}
										>
											<td>
												<span className={`${s.badge} ${toneClass}`}>
													{actionIcon}
													<span>{formatAuditAction(record.islem, t)}</span>
												</span>
											</td>
											<td>
												<div className={s.userCell} title={actorName}>
													<div className={s.userAvatar}>
														{actorName.charAt(0).toUpperCase()}
													</div>
													<span className={s.userName}>{actorName}</span>
												</div>
											</td>
											<td>
												<span className={s.targetPill} title={targetName}>
													{targetName}
												</span>
											</td>
											<td>
												{diffSummary ? (
													<span className={s.diffChip}>{diffSummary}</span>
												) : (
													<span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>—</span>
												)}
											</td>
											<td>
												<code className={s.ipMono}>{record.ip || '127.0.0.1'}</code>
											</td>
											<td>
												<span
													className={s.timeText}
													title={formatDateTime(record.zaman, isEn ? 'en-GB' : 'tr-TR')}
												>
													{formatRelativeTime(record.zaman, isEn)}
												</span>
											</td>
											<td style={{ textAlign: 'right' }}>
												<button
													type="button"
													className={s.actionBtn}
													style={{ padding: '3px 8px', fontSize: 11 }}
													onClick={(e) => {
														e.stopPropagation();
														setInspectRecord(record);
													}}
													title={isEn ? 'Inspect event diff' : 'Olay detayını incele'}
												>
													<Eye size={12} />
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{/* ========================================================= */}
				{/* 2. Mobile Responsive Card Stream                          */}
				{/* ========================================================= */}
				{filteredRecords.length > 0 && (
					<div className={s.mobileCardStream}>
						{filteredRecords.map((record) => {
							const tone = getActionTone(record.islem);
							const toneClass =
								tone === 'create'
									? s.badgeCreate
									: tone === 'delete'
									? s.badgeDelete
									: tone === 'security'
									? s.badgeSecurity
									: s.badgeUpdate;

							const actionIcon =
								tone === 'create' ? (
									<PlusCircle size={11} />
								) : tone === 'delete' ? (
									<Trash size={11} />
								) : tone === 'security' ? (
									<ShieldAlert size={11} />
								) : (
									<Sliders size={11} />
								);

							const diffSummary = getDiffSummary(record, t, isEn);
							const actorName = record.yapanAd || record.yapanId || 'System';
							const targetName = record.hedefAd || record.hedefId || '—';

							return (
								<button
									type="button"
									key={`mobile-${record.id}`}
									className={s.auditCardItem}
									onClick={() => setInspectRecord(record)}
								>
									{/* Top Row: Action Badge + Relative Time */}
									<div className={s.cardTopRow}>
										<span className={`${s.badge} ${toneClass}`}>
											{actionIcon}
											<span>{formatAuditAction(record.islem, t)}</span>
										</span>
										<span
											className={s.timeText}
											title={formatDateTime(record.zaman, isEn ? 'en-GB' : 'tr-TR')}
										>
											{formatRelativeTime(record.zaman, isEn)}
										</span>
									</div>

									{/* Middle Flow: Actor -> Target */}
									<div className={s.cardFlowRow}>
										<div className={s.userCell}>
											<div className={s.userAvatar}>{actorName.charAt(0).toUpperCase()}</div>
											<span className={s.userName}>{actorName}</span>
										</div>
										<span className={s.flowArrow}>
											<ArrowRight size={12} />
										</span>
										<span className={s.targetPill}>{targetName}</span>
									</div>

									{/* Bottom Info: IP, Diff Chip & Tap Hint */}
									<div className={s.cardBottomRow}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
											<code className={s.ipMono}>{record.ip || '127.0.0.1'}</code>
											{diffSummary && <span className={s.diffChip}>{diffSummary}</span>}
										</div>
										<span className={s.inspectHint}>
											<span>{isEn ? 'Details' : 'İncele'}</span>
											<ChevronRight size={12} />
										</span>
									</div>
								</button>
							);
						})}
					</div>
				)}

				{/* Pager Bar */}
				{totalPages > 1 && (
					<div className={s.paginationBar}>
						<span className={s.pageInfo}>
							{fill(t('auditSayfa'), { current: currentPage, total: totalPages })}
						</span>

						<div className={s.pagerBtns}>
							<button
								type="button"
								className={s.pagerBtn}
								disabled={currentPage <= 1}
								onClick={() => setCurrentPage((p) => p - 1)}
								title={t('previous')}
							>
								<ChevronLeft size={14} />
							</button>
							<button
								type="button"
								className={s.pagerBtn}
								disabled={currentPage >= totalPages}
								onClick={() => setCurrentPage((p) => p + 1)}
								title={t('next')}
							>
								<ChevronRight size={14} />
							</button>
						</div>
					</div>
				)}
			</section>

			{/* ========================================================= */}
			{/* Detail & Forensics Modal                                  */}
			{/* ========================================================= */}
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

// ---------------------------------------------------------------------------
// Dedicated SOC Audit Detail & Forensics Sheet
// ---------------------------------------------------------------------------

function SocAuditDetailSheet({
	record,
	onClose,
	onPivotToSiem,
}: {
	record: AuditRecord;
	onClose: () => void;
	onPivotToSiem: (ip: string) => void;
}) {
	const { t, language } = useI18n();
	const isEn = language === 'en';
	const [activeTab, setActiveTab] = useState<'diff' | 'raw'>('diff');
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const diffs = useMemo(() => diffRows(record.onceki, record.sonraki), [record.onceki, record.sonraki]);

	const copyWithFeedback = (key: string, text: string) => {
		copyToClipboard(text);
		setCopiedField(key);
		setTimeout(() => setCopiedField(null), 1400);
	};

	const formatAuditValue = (alan: string, val: unknown): string => {
		if (val === null || val === undefined) return '—';
		if (typeof val === 'boolean') {
			return val ? t('auditYes') : t('auditNo');
		}
		if (alan === 'roleId' || alan === 'tasinanRolId') {
			if (val === 'rol_admin') return t('auditRoleAdmin', 'Yönetici (Admin)');
			if (val === 'rol_yonetim_kurulu') return t('auditRoleBoard', 'Board Member');
			if (val === 'rol_uye') return t('auditRoleMember', 'Member');
			if (val === 'rol_mezun') return t('auditRoleAlumni', 'Alumni');
		}
		if (typeof val === 'string') {
			if (
				val === 'yok' ||
				val === 'kullan' ||
				val === 'yonet' ||
				val === 'aktif' ||
				val === 'mezun' ||
				val === 'beklemede' ||
				val === 'reddedildi'
			) {
				return t(`auditValue_${val}`, val);
			}
		}
		return String(val);
	};

	const actionTitle = formatAuditAction(record.islem, t);
	const actorName = record.yapanAd || record.yapanId || 'System';
	const targetName = record.hedefAd || record.hedefId || '—';

	return (
		<Sheet
			title={actionTitle}
			label={actionTitle}
			icon={<History size={18} />}
			onClose={onClose}
			maxWidth={680}
		>
			{/* Summary Metadata Grid */}
			<div className={s.modalSummaryGrid}>
				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditYapan')}</span>
					<div className={s.summaryValue}>
						<span>{actorName}</span>
						<button
							type="button"
							className={s.copyMiniBtn}
							onClick={() => copyWithFeedback('actor', actorName)}
							title={isEn ? 'Copy actor' : 'Yapanı kopyala'}
						>
							{copiedField === 'actor' ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
						</button>
					</div>
				</div>

				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditHedef')}</span>
					<div className={s.summaryValue}>
						<span>{targetName}</span>
						<button
							type="button"
							className={s.copyMiniBtn}
							onClick={() => copyWithFeedback('target', targetName)}
							title={isEn ? 'Copy target' : 'Hedefi kopyala'}
						>
							{copiedField === 'target' ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
						</button>
					</div>
				</div>

				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditZaman')}</span>
					<div className={s.summaryValue}>
						<span style={{ fontVariantNumeric: 'tabular-nums' }}>
							{formatDateTime(record.zaman, isEn ? 'en-GB' : 'tr-TR')}
						</span>
					</div>
				</div>

				<div className={s.summaryItem}>
					<span className={s.summaryLabel}>{t('auditIp')}</span>
					<div className={s.summaryValue}>
						<code className={s.ipMono}>{record.ip || '127.0.0.1'}</code>
						<button
							type="button"
							className={s.copyMiniBtn}
							onClick={() => copyWithFeedback('ip', record.ip || '127.0.0.1')}
							title={isEn ? 'Copy IP' : 'IP kopyala'}
						>
							{copiedField === 'ip' ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
						</button>
						{record.ip && record.ip !== '127.0.0.1' && record.ip !== 'unknown' && (
							<button
								type="button"
								className={s.pivotBtn}
								onClick={() => onPivotToSiem(record.ip)}
								title={isEn ? 'Pivot into SIEM logs' : 'SIEM kayıtlarında filtrele'}
							>
								<ExternalLink size={10} />
								<span>SIEM</span>
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Tab Switcher: Diff vs Raw JSON */}
			<div className={s.modalTabs}>
				<button
					type="button"
					className={`${s.modalTabBtn} ${activeTab === 'diff' ? s.modalTabBtnActive : ''}`}
					onClick={() => setActiveTab('diff')}
				>
					<FileText size={13} />
					<span>{isEn ? 'Field Diffs' : 'Değişiklik Detayı'}</span>
				</button>
				<button
					type="button"
					className={`${s.modalTabBtn} ${activeTab === 'raw' ? s.modalTabBtnActive : ''}`}
					onClick={() => setActiveTab('raw')}
				>
					<Code2 size={13} />
					<span>{isEn ? 'Forensics JSON' : 'Adli JSON Kaydı'}</span>
				</button>
			</div>

			{/* Tab 1: Diff Viewer */}
			{activeTab === 'diff' && (
				<>
					{diffs.length === 0 ? (
						<div className={s.emptyState}>
							<History size={24} style={{ opacity: 0.3 }} />
							<span>{t('auditFarkYok')}</span>
						</div>
					) : (
						<>
							{/* Desktop Diff Table */}
							<div className={s.diffTableWrap}>
								<table className={s.diffTable}>
									<thead>
										<tr>
											<th style={{ width: '38%' }}>{t('auditAlan')}</th>
											<th style={{ width: '31%' }}>{t('auditOnceki')}</th>
											<th style={{ width: '31%' }}>{t('auditSonraki')}</th>
										</tr>
									</thead>
									<tbody>
										{diffs.map((d: DiffRow) => {
											const appKey = d.alan.startsWith('izinler.')
												? d.alan.slice('izinler.'.length)
												: d.alan;
											const appMeta = isPermissionApp(appKey)
												? getAppMeta(appKey as AppID, language)
												: null;
											const label = isPermissionApp(appKey)
												? appMeta?.shortTitle ||
												  appMeta?.title ||
												  PERMISSION_DESCRIPTIONS[appKey]?.ad ||
												  appKey
												: t(`auditField_${d.alan}`, d.alan);

											return (
												<tr key={d.alan}>
													<td>
														<strong style={{ color: 'var(--text-primary)' }}>{label}</strong>
														{d.alan.includes('.') && (
															<span
																style={{
																	display: 'block',
																	fontSize: 10,
																	color: 'var(--text-secondary)',
																	opacity: 0.7,
																}}
															>
																{d.alan}
															</span>
														)}
													</td>
													<td>
														<span className={s.diffOldVal}>
															{formatAuditValue(d.alan, d.onceki)}
														</span>
													</td>
													<td>
														<span className={s.diffNewVal}>
															{formatAuditValue(d.alan, d.sonraki)}
														</span>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

							{/* Mobile Diff Cards */}
							<div className={s.diffCardsMobile}>
								{diffs.map((d: DiffRow) => {
									const appKey = d.alan.startsWith('izinler.')
										? d.alan.slice('izinler.'.length)
										: d.alan;
									const appMeta = isPermissionApp(appKey)
										? getAppMeta(appKey as AppID, language)
										: null;
									const label = isPermissionApp(appKey)
										? appMeta?.shortTitle ||
										  appMeta?.title ||
										  PERMISSION_DESCRIPTIONS[appKey]?.ad ||
										  appKey
										: t(`auditField_${d.alan}`, d.alan);

									return (
										<div key={`mobile-diff-${d.alan}`} className={s.diffFieldCard}>
											<span className={s.diffFieldName}>{label}</span>
											<div className={s.diffComparison}>
												<div className={s.diffCol}>
													<span className={s.diffColLabel}>{t('auditOnceki')}</span>
													<span className={s.diffOldVal}>
														{formatAuditValue(d.alan, d.onceki)}
													</span>
												</div>
												<div className={s.diffCol}>
													<span className={s.diffColLabel}>{t('auditSonraki')}</span>
													<span className={s.diffNewVal}>
														{formatAuditValue(d.alan, d.sonraki)}
													</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}
				</>
			)}

			{/* Tab 2: Forensic Raw JSON Viewer */}
			{activeTab === 'raw' && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
						<button
							type="button"
							className={s.actionBtn}
							style={{ padding: '3px 9px', fontSize: 11 }}
							onClick={() => copyWithFeedback('json', JSON.stringify(record, null, 2))}
						>
							{copiedField === 'json' ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
							<span>{copiedField === 'json' ? (isEn ? 'Copied!' : 'Kopyalandı!') : (isEn ? 'Copy JSON' : 'JSON Kopyala')}</span>
						</button>
					</div>
					<pre className={s.jsonPre}>{JSON.stringify(record, null, 2)}</pre>
				</div>
			)}
		</Sheet>
	);
}
