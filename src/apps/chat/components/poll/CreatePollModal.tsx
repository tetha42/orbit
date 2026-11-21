'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';
import {
	CreatePollSettings,
	computePollEndsAt,
	type DurationOption,
} from './CreatePollSettings';
import m from '../../ChatModals.module.css';
import s from '../../ChatPoll.module.css';

interface CreatePollModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (pollData: {
		question: string;
		options: string[];
		multipleSelection: boolean;
		anonymous: boolean;
		endsAt: number | null;
	}) => Promise<boolean>;
}

export function CreatePollModal(props: CreatePollModalProps) {
	if (!props.isOpen) return null;
	return <CreatePollDialog {...props} />;
}

function CreatePollDialog({ onClose, onSubmit }: CreatePollModalProps) {
	const { t } = useI18n();
	const [question, setQuestion] = useState('');
	const [options, setOptions] = useState<string[]>(['']);
	const [multipleSelection, setMultipleSelection] = useState(false);
	const [anonymous, setAnonymous] = useState(true);
	const [duration, setDuration] = useState<DurationOption>('none');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleAddOption = () => {
		if (options.length >= 10) return;
		setOptions((prev) => [...prev, '']);
	};

	const handleRemoveOption = (index: number) => {
		if (options.length <= 2) return;
		setOptions((prev) => prev.filter((_, i) => i !== index));
	};

	const handleOptionChange = (index: number, value: string) => {
		setOptions((prev) => {
			const updated = [...prev];
			updated[index] = value;
			return updated;
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const cleanQuestion = question.trim();
		if (!cleanQuestion) {
			setError(t('chatPollQuestionRequired'));
			return;
		}

		const cleanOptions = options.map((opt) => opt.trim()).filter(Boolean);
		if (cleanOptions.length < 2) {
			setError(t('chatPollMinOptionsError'));
			return;
		}

		setError(null);
		setSubmitting(true);

		try {
			const ok = await onSubmit({
				question: cleanQuestion,
				options: cleanOptions,
				multipleSelection,
				anonymous,
				endsAt: computePollEndsAt(duration),
			});
			if (ok) {
				onClose();
			} else {
				setError(t('chatPollCreateError'));
			}
		} catch {
			setError(t('chatPollCreateError'));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className={m.modalOverlay} role="dialog" aria-modal="true">
			<div className={`${m.modalDialog} ${s.pollModalDialog}`}>
				<div className={m.modalHeader}>
					<div className={m.modalTitle}>
						<BarChart2 size={18} />
						<span>{t('chatPollModalTitle')}</span>
					</div>
					<button
						type="button"
						className={m.modalCloseBtn}
						onClick={onClose}
						aria-label={t('close')}
					>
						<X size={16} />
					</button>
				</div>

				<form onSubmit={handleSubmit} className={s.pollForm}>
					<div className={s.pollModalBody}>
						{error && <div className={s.pollErrorBanner}>{error}</div>}

						<div className={s.pollFieldGroup}>
							<label className={s.pollFieldLabel}>{t('question')}</label>
							<textarea
								className={s.pollQuestionInput}
								placeholder={t('chatPollQuestionPh')}
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								rows={2}
								autoFocus
							/>
						</div>

						<div className={s.pollFieldGroup}>
							<label className={s.pollFieldLabel}>{t('options')}</label>
							<div className={s.pollOptionsList}>
								{options.map((opt, idx) => (
									<div key={idx} className={s.pollOptionRow}>
										<span className={s.pollOptionBadge}>{idx + 1}</span>
										<input
											type="text"
											className={s.pollOptionInput}
											placeholder={fill(t('chatPollOptionPh'), { n: idx + 1 })}
											value={opt}
											onChange={(e) => handleOptionChange(idx, e.target.value)}
										/>
										{options.length > 2 && (
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

							{options.length < 10 && (
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

						<CreatePollSettings
							anonymous={anonymous}
							onAnonymousChange={setAnonymous}
							multipleSelection={multipleSelection}
							onMultipleSelectionChange={setMultipleSelection}
							duration={duration}
							onDurationChange={setDuration}
						/>
					</div>

					<div className={m.modalFooter}>
						<button
							type="button"
							className={m.modalCloseBtn}
							onClick={onClose}
							disabled={submitting}
						>
							{t('cancel')}
						</button>
						<button
							type="submit"
							className={m.primaryActionBtn}
							disabled={submitting || !question.trim()}
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
