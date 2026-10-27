'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Undo2, Clock, User } from 'lucide-react';
import { useDialog } from '@/components/Common/DialogProvider';
import type { AuditRecord } from '../types';

interface DatabaseAuditViewProps {
	dbToken: string;
	onRevertSuccess?: () => void;
}

export function DatabaseAuditView({ dbToken, onRevertSuccess }: DatabaseAuditViewProps) {
	const dialog = useDialog();

	const [records, setRecords] = useState<AuditRecord[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [revertingId, setRevertingId] = useState<number | null>(null);

	const fetchAudit = useCallback(async () => {
		if (!dbToken) return;
		setIsLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/database/audit', {
				headers: { 'x-db-token': dbToken },
			});
			if (!res.ok) throw new Error('Denetim kayıtları alınamadı.');
			const data = await res.json();
			setRecords(data.records || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Denetim kayıtları okunamadı.');
		} finally {
			setIsLoading(false);
		}
	}, [dbToken]);

	useEffect(() => {
		void fetchAudit();
	}, [fetchAudit]);

	const handleRevert = async (rec: AuditRecord) => {
		const confirmed = await dialog.confirm({
			title: 'Değişikliği Geri Al (Rollback)',
			message: `'${rec.hedefId}' tablosundaki (#${rec.id}) numaralı işlemi eski haline döndürmek istediğinize emin misiniz?`,
			tone: 'warning',
		});

		if (!confirmed) return;

		setRevertingId(rec.id);
		try {
			const res = await fetch('/api/database/audit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({ auditId: rec.id }),
			});

			const data = await res.json();
			if (!res.ok) {
				await dialog.alert({
					title: 'Geri Alma Başarısız',
					message: data.error || 'İşlem geri alınamadı.',
					tone: 'danger',
				});
				return;
			}

			await dialog.alert({
				title: 'Başarılı',
				message: data.message || 'Kayıt başarıyla eski haline döndürüldü.',
			});

			void fetchAudit();
			onRevertSuccess?.();
		} catch (err) {
			await dialog.alert({
				title: 'Hata',
				message: err instanceof Error ? err.message : 'Ağ hatası.',
				tone: 'danger',
			});
		} finally {
			setRevertingId(null);
		}
	};

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--window-bg)',
				overflow: 'hidden',
			}}
		>
			{/* Top Bar */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '12px 18px',
					borderBottom: '1px solid var(--window-border)',
					background: 'var(--fill-softer)',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<ShieldCheck size={18} color="var(--success)" />
					<div>
						<div style={{ fontSize: '14px', fontWeight: 700 }}>
							Güvenlik Kalkanı & Hücre Denetim İzi (Audit Diff)
						</div>
						<div style={{ fontSize: '11px', opacity: 0.6 }}>
							DB Studio üzerinden yapılan tüm hücre güncellemeleri, değiştiren yönetici ve tek tıkla geri alma.
						</div>
					</div>
				</div>

				<button
					type="button"
					onClick={fetchAudit}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '5px',
						padding: '5px 12px',
						borderRadius: '6px',
						fontSize: '11.5px',
						background: 'var(--fill-soft)',
						border: '1px solid var(--window-border)',
						color: 'inherit',
						cursor: 'pointer',
					}}
				>
					<RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
					<span>Yenile</span>
				</button>
			</div>

			{/* Records Table / List */}
			<div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
				{isLoading && records.length === 0 ? (
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6 }}>
						<RefreshCw size={20} className="animate-spin" />
					</div>
				) : error ? (
					<div style={{ padding: '20px', color: 'var(--danger)', textAlign: 'center' }}>{error}</div>
				) : records.length === 0 ? (
					<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: '8px' }}>
						<ShieldCheck size={32} />
						<div style={{ fontSize: '13px' }}>Henüz kaydedilmiş bir hücre düzenleme geçmişi yok.</div>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
						{records.map((rec) => {
							const onceki = rec.onceki || {};
							const sonraki = rec.sonraki || {};
							const pkVal = onceki.pkVal ?? sonraki.pkVal;

							// Extract changed keys excluding pkCol and pkVal
							const changedKeys = Object.keys(sonraki).filter((k) => k !== 'pkCol' && k !== 'pkVal');

							return (
								<div
									key={rec.id}
									style={{
										padding: '12px 16px',
										borderRadius: '10px',
										background: 'var(--fill-softer)',
										border: '1px solid var(--window-border)',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										gap: '16px',
										flexWrap: 'wrap',
									}}
								>
									<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
											<span
												style={{
													fontSize: '11px',
													fontWeight: 700,
													padding: '2px 7px',
													borderRadius: '4px',
													background: 'var(--accent)',
													color: 'var(--accent-contrast)',
												}}
											>
												{rec.hedefId} #{String(pkVal)}
											</span>

											<span style={{ fontSize: '11.5px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}>
												<User size={11} />
												<strong>{rec.yapanAd || 'Yönetici'}</strong>
											</span>

											<span style={{ fontSize: '11px', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
												<Clock size={11} />
												{new Date(Number(rec.zaman)).toLocaleString()}
											</span>
										</div>

										{/* Diff pills */}
										<div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
											{changedKeys.map((key) => {
												const oldVal = onceki[key];
												const newVal = sonraki[key];
												return (
													<div
														key={key}
														style={{
															display: 'flex',
															alignItems: 'center',
															gap: '8px',
															fontSize: '11.5px',
															fontFamily: 'monospace',
														}}
													>
														<span style={{ fontWeight: 600, minWidth: '80px' }}>{key}:</span>
														<span
															style={{
																padding: '1px 6px',
																borderRadius: '4px',
																background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
																color: 'var(--danger)',
																border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
															}}
														>
															{oldVal !== undefined && oldVal !== null ? String(oldVal) : 'NULL'}
														</span>
														<span style={{ opacity: 0.4 }}>→</span>
														<span
															style={{
																padding: '1px 6px',
																borderRadius: '4px',
																background: 'color-mix(in srgb, var(--success) 14%, transparent)',
																color: 'var(--success)',
																border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
															}}
														>
															{newVal !== undefined && newVal !== null ? String(newVal) : 'NULL'}
														</span>
													</div>
												);
											})}
										</div>
									</div>

									{/* Revert Action */}
									<button
										type="button"
										onClick={() => handleRevert(rec)}
										disabled={revertingId === rec.id}
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '6px',
											padding: '6px 12px',
											borderRadius: '6px',
											fontSize: '11.5px',
											fontWeight: 600,
											background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
											color: 'var(--warning)',
											border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
											cursor: revertingId === rec.id ? 'not-allowed' : 'pointer',
											opacity: revertingId === rec.id ? 0.6 : 1,
											transition: 'all 0.15s ease',
										}}
									>
										<Undo2 size={13} />
										<span>{revertingId === rec.id ? 'Geri Alınıyor...' : 'Eski Değere Döndür'}</span>
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
