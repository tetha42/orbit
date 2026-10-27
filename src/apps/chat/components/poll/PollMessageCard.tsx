'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useNow } from '@/lib/client/useSheet';
import { fill } from '@/lib/text';
import {
	BarChart2,
	CheckSquare,
	Square,
	Circle,
	CheckCircle2,
	Shield,
	Users,
	Clock,
	Lock,
} from 'lucide-react';
import type { ChatPollItem } from '../../types';
import s from '../../Chat.module.css';

interface PollMessageCardProps {
	poll: ChatPollItem;
	currentUserId: string;
	isAdmin: boolean;
	onVote: (pollId: string, secenekId: string) => Promise<boolean>;
	onClosePoll: (pollId: string) => Promise<boolean>;
}

export function PollMessageCard({
	poll,
	currentUserId,
	isAdmin,
	onVote,
	onClosePoll,
}: PollMessageCardProps) {
	const { t } = useI18n();
	const now = useNow(10_000);
	const [votingOptId, setVotingOptId] = useState<string | null>(null);
	const [closing, setClosing] = useState(false);

	const isClosed =
		Boolean(poll.kapali) ||
		(typeof poll.endsAt === 'number' && now > poll.endsAt);

	const canClose = (isAdmin || poll.olusturanId === currentUserId) && !isClosed;

	const handleOptionClick = async (secenekId: string) => {
		if (isClosed || votingOptId) return;
		setVotingOptId(secenekId);
		try {
			await onVote(poll.id, secenekId);
		} finally {
			setVotingOptId(null);
		}
	};

	const handleClose = async () => {
		if (closing || isClosed) return;
		setClosing(true);
		try {
			await onClosePoll(poll.id);
		} finally {
			setClosing(false);
		}
	};

	// Format remaining time if poll has expiration
	const getRemainingText = () => {
		if (isClosed) return t('chatPollClosedBadge') || 'Anket Kapandı';
		if (!poll.endsAt) return null;

		const diffSec = Math.max(0, Math.floor((poll.endsAt - now) / 1000));
		if (diffSec <= 0) return t('chatPollEnded') || 'Süresi doldu';

		const hours = Math.floor(diffSec / 3600);
		const minutes = Math.floor((diffSec % 3600) / 60);

		let timeStr = '';
		if (hours > 24) {
			const days = Math.floor(hours / 24);
			timeStr = `${days} gün`;
		} else if (hours > 0) {
			timeStr = `${hours} sa ${minutes} dk`;
		} else {
			timeStr = `${minutes} dk`;
		}

		return fill(t('chatPollEndsIn'), { time: timeStr });
	};

	const remainingText = getRemainingText();

	return (
		<div className={`${s.pollCard} ${isClosed ? s.pollCardClosed : ''}`}>
			{/* Poll Header */}
			<div className={s.pollHeader}>
				<div className={s.pollTitleRow}>
					<div className={s.pollIconBadge}>
						<BarChart2 size={16} />
					</div>
					<h4 className={s.pollQuestion}>{poll.soru}</h4>
				</div>

				<div className={s.pollMetaTags}>
					{poll.anonim ? (
						<span className={s.pollMetaTag} title={t('chatPollAnonymousDesc')}>
							<Shield size={12} />
							<span>{t('chatPollAnonymous')}</span>
						</span>
					) : (
						<span className={s.pollMetaTag} title={t('chatPollVotersTitle')}>
							<Users size={12} />
							<span>{t('chatPollVotersTitle')}</span>
						</span>
					)}

					{poll.cokluSecim && (
						<span className={s.pollMetaTag}>
							<CheckSquare size={12} />
							<span>{t('chatPollMultiChoice')}</span>
						</span>
					)}

					{remainingText && (
						<span className={`${s.pollMetaTag} ${isClosed ? s.pollMetaTagClosed : ''}`}>
							<Clock size={12} />
							<span>{remainingText}</span>
						</span>
					)}
				</div>
			</div>

			{/* Options List */}
			<div className={s.pollOptionsContainer}>
				{poll.secenekler.map((opt) => {
					const isVoted = poll.kullaniciOylari.includes(opt.id);
					const isPending = votingOptId === opt.id;

					return (
						<button
							key={opt.id}
							type="button"
							className={`${s.pollOptionCard} ${isVoted ? s.pollOptionCardVoted : ''} ${
								isClosed ? s.pollOptionCardDisabled : ''
							}`}
							onClick={() => handleOptionClick(opt.id)}
							disabled={isClosed || isPending}
						>
							{/* Background Progress Bar */}
							<div
								className={`${s.pollProgressBar} ${isVoted ? s.pollProgressBarVoted : ''}`}
								style={{ width: `${opt.yuzde}%` }}
							/>

							{/* Option Content */}
							<div className={s.pollOptionContent}>
								<div className={s.pollOptionLeft}>
									<div className={s.pollCheckIcon}>
										{poll.cokluSecim ? (
											isVoted ? (
												<CheckSquare size={16} className={s.pollCheckActive} />
											) : (
												<Square size={16} />
											)
										) : isVoted ? (
											<CheckCircle2 size={16} className={s.pollCheckActive} />
										) : (
											<Circle size={16} />
										)}
									</div>
									<span className={s.pollOptionText}>{opt.metin}</span>
								</div>

								<div className={s.pollOptionRight}>
									<span className={s.pollOptionPercentage}>%{opt.yuzde}</span>
									<span className={s.pollOptionCount}>
										({fill(t('chatPollTotalVotes'), { n: opt.oySayisi })})
									</span>
								</div>
							</div>

							{/* Non-anonymous Voter Avatars */}
							{!poll.anonim && opt.oyVerenler && opt.oyVerenler.length > 0 && (
								<div className={s.pollVotersRow}>
									{opt.oyVerenler.slice(0, 5).map((voter) => (
										<span
											key={voter.id}
											className={s.pollVoterAvatar}
											title={voter.ad}
										>
											{voter.foto ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={voter.foto}
													alt={voter.ad}
													style={{ width: '100%', height: '100%', borderRadius: '50%' }}
												/>
											) : (
												voter.ad.slice(0, 1).toUpperCase()
											)}
										</span>
									))}
									{opt.oyVerenler.length > 5 && (
										<span className={s.pollVotersMore}>
											+{opt.oyVerenler.length - 5}
										</span>
									)}
								</div>
							)}
						</button>
					);
				})}
			</div>

			{/* Footer: Total Votes & Admin Close Button */}
			<div className={s.pollCardFooter}>
				<span className={s.pollTotalCount}>
					{fill(t('chatPollTotalVotes'), { n: poll.toplamOy })}
				</span>

				{canClose && (
					<button
						type="button"
						className={s.pollCloseBtn}
						onClick={handleClose}
						disabled={closing}
						title={t('chatPollClose')}
					>
						<Lock size={13} />
						<span>{closing ? t('chatPollSubmitting') : t('chatPollClose')}</span>
					</button>
				)}
			</div>
		</div>
	);
}
