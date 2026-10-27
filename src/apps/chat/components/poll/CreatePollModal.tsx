'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { X, Plus, Trash2, BarChart2, Shield, CheckSquare, Clock } from 'lucide-react';
import s from '../../Chat.module.css';

interface CreatePollModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (pollData: {
		soru: string;
		secenekler: string[];
		cokluSecim: boolean;
		anonim: boolean;
		endsAt: number | null;
	}) => Promise<boolean>;
}

type DurationOption = 'none' | '1h' | '24h' | '3d' | '1w';

export function CreatePollModal(props: CreatePollModalProps) {
	if (!props.isOpen) return null;
	return <CreatePollDialog {...props} />;
}

function CreatePollDialog({ onClose, onSubmit }: CreatePollModalProps) {
	const { t } = useI18n();
	const [soru, setSoru] = useState('');
	const [secenekler, setSecenekler] = useState<string[]>(['', '']);
	const [cokluSecim, setCokluSecim] = useState(false);
	const [anonim, setAnonim] = useState(true);
	const [duration, setDuration] = useState<DurationOption>('none');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleAddOption = () => {
		if (secenekler.length >= 10) return;
		setSecenekler((prev) => [...prev, '']);
	};

	const handleRemoveOption = (index: number) => {
		if (secenekler.length <= 2) return;
		setSecenekler((prev) => prev.filter((_, i) => i !== index));
	};

	const handleOptionChange = (index: number, value: string) => {
		setSecenekler((prev) => {
			const updated = [...prev];
			updated[index] = value;
			return updated;
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const cleanSoru = soru.trim();
		if (!cleanSoru) {
			setError(t('chatPollQuestionRequired'));
			return;
		}

		const cleanSecenekler = secenekler.map((opt) => opt.trim()).filter(Boolean);
		if (cleanSecenekler.length < 2) {
			setError(t('chatPollMinOptionsError'));
			return;
		}

		setError(null);
		setSubmitting(true);

		let endsAt: number | null = null;
		const now = Date.now();
		if (duration === '1h') endsAt = now + 3600 * 1000;
		else if (duration === '24h') endsAt = now + 86400 * 1000;
		else if (duration === '3d') endsAt = now + 3 * 86400 * 1000;
		else if (duration === '1w') endsAt = now + 7 * 86400 * 1000;

		try {
			const ok = await onSubmit({
				soru: cleanSoru,
				secenekler: cleanSecenekler,
				cokluSecim,
				anonim,
				endsAt,
			});
			if (ok) {
				onClose();
			} else {
				setError(t('chatPollCreateError') || 'Anket oluşturulamadı.');
			}
		} catch {
			setError(t('chatPollCreateError') || 'Anket oluşturulurken bir hata oluştu.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className={s.modalOverlay} role="dialog" aria-modal="true">
			<div className={`${s.modalDialog} ${s.pollModalDialog}`}>
				{/* Modal Header */}
				<div className={s.modalHeader}>
					<div className={s.modalTitle}>
						<BarChart2 size={18} />
						<span>{t('chatPollModalTitle')}</span>
					</div>
					<button
						type="button"
						className={s.modalCloseBtn}
						onClick={onClose}
						aria-label={t('close')}
					>
						<X size={16} />
					</button>
				</div>

				{/* Modal Body / Form */}
				<form onSubmit={handleSubmit} className={s.pollForm}>
					<div className={s.pollModalBody}>
						{error && <div className={s.pollErrorBanner}>{error}</div>}

						{/* Question Input */}
						<div className={s.pollFieldGroup}>
							<label className={s.pollFieldLabel}>{t('question') || 'Soru'}</label>
							<textarea
								className={s.pollQuestionInput}
								placeholder={t('chatPollQuestionPh')}
								value={soru}
								onChange={(e) => setSoru(e.target.value)}
								rows={2}
								autoFocus
							/>
						</div>

						{/* Options List */}
						<div className={s.pollFieldGroup}>
							<label className={s.pollFieldLabel}>{t('options') || 'Seçenekler'}</label>
							<div className={s.pollOptionsList}>
								{secenekler.map((opt, idx) => (
									<div key={idx} className={s.pollOptionRow}>
										<span className={s.pollOptionBadge}>{idx + 1}</span>
										<input
											type="text"
											className={s.pollOptionInput}
											placeholder={fill(t('chatPollOptionPh'), { n: idx + 1 })}
											value={opt}
											onChange={(e) => handleOptionChange(idx, e.target.value)}
										/>
										{secenekler.length > 2 && (
											<button
												type="button"
												className={s.pollRemoveOptionBtn}
												onClick={() => handleRemoveOption(idx)}
												title={t('delete')}
											>
												<Trash2 size={14} />
											</button>
										)}
									</div>
								))}
							</div>

							{secenekler.length < 10 && (
								<button
									type="button"
									className={s.pollAddOptionBtn}
									onClick={handleAddOption}
								>
									<Plus size={14} />
									<span>{t('chatPollAddOption')}</span>
								</button>
							)}
						</div>

						{/* Settings: Anonymous & Multi-choice */}
						<div className={s.pollSettingsContainer}>
							<label className={s.pollSettingItem}>
								<div className={s.pollSettingInfo}>
									<div className={s.pollSettingTitle}>
										<Shield size={15} />
										<span>{t('chatPollAnonymous')}</span>
									</div>
									<div className={s.pollSettingDesc}>{t('chatPollAnonymousDesc')}</div>
								</div>
								<input
									type="checkbox"
									className={s.pollToggle}
									checked={anonim}
									onChange={(e) => setAnonim(e.target.checked)}
								/>
							</label>

							<label className={s.pollSettingItem}>
								<div className={s.pollSettingInfo}>
									<div className={s.pollSettingTitle}>
										<CheckSquare size={15} />
										<span>{t('chatPollMultiChoice')}</span>
									</div>
									<div className={s.pollSettingDesc}>{t('chatPollMultiChoiceDesc')}</div>
								</div>
								<input
									type="checkbox"
									className={s.pollToggle}
									checked={cokluSecim}
									onChange={(e) => setCokluSecim(e.target.checked)}
								/>
							</label>

							{/* Duration Segment Control */}
							<div className={s.pollDurationGroup}>
								<div className={s.pollDurationTitle}>
									<Clock size={15} />
									<span>{t('chatPollDuration')}</span>
								</div>
								<div className={s.pollDurationSegments}>
									{(
										[
											{ id: 'none', labelKey: 'chatPollDurationUnlimited' },
											{ id: '1h', labelKey: 'chatPollDuration1h' },
											{ id: '24h', labelKey: 'chatPollDuration24h' },
											{ id: '3d', labelKey: 'chatPollDuration3d' },
											{ id: '1w', labelKey: 'chatPollDuration1w' },
										] as const
									).map((item) => (
										<button
											key={item.id}
											type="button"
											className={`${s.pollDurationBtn} ${
												duration === item.id ? s.pollDurationBtnActive : ''
											}`}
											onClick={() => setDuration(item.id)}
										>
											{t(item.labelKey)}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* Modal Footer */}
					<div className={s.modalFooter}>
						<button
							type="button"
							className={s.modalCloseBtn}
							onClick={onClose}
							disabled={submitting}
						>
							{t('cancel')}
						</button>
						<button
							type="submit"
							className={s.primaryActionBtn}
							disabled={submitting || !soru.trim()}
						>
							<BarChart2 size={16} />
							<span>{submitting ? t('chatPollSubmitting') : t('chatPollSubmit')}</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
