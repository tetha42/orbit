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
	onVote: (pollId: string, optionId: string) => Promise<boolean>;
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
		Boolean(poll.closed) ||
		(typeof poll.endsAt === 'number' && now > poll.endsAt);

	const canClose = (isAdmin || poll.creatorId === currentUserId) && !isClosed;

	const handleOptionClick = async (optionId: string) => {
		if (isClosed || votingOptId) return;
		setVotingOptId(optionId);
		try {
			await onVote(poll.id, optionId);
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
					<h4 className={s.pollQuestion}>{poll.question}</h4>
				</div>

				<div className={s.pollMetaTags}>
					{poll.anonymous ? (
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

					{poll.multipleSelection && (
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
				{poll.options.map((opt) => {
					const isVoted = poll.userVotes.includes(opt.id);
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
								style={{ width: `${opt.percent}%` }}
							/>

							{/* Option Content */}
							<div className={s.pollOptionContent}>
								<div className={s.pollOptionLeft}>
									<div className={s.pollCheckIcon}>
										{poll.multipleSelection ? (
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
									<span className={s.pollOptionText}>{opt.text}</span>
								</div>

								<div className={s.pollOptionRight}>
									<span className={s.pollOptionPercentage}>%{opt.percent}</span>
									<span className={s.pollOptionCount}>
										({fill(t('chatPollTotalVotes'), { n: opt.voteCount })})
									</span>
								</div>
							</div>

							{/* Non-anonymous Voter Avatars */}
							{!poll.anonymous && opt.voteGivers && opt.voteGivers.length > 0 && (
								<div className={s.pollVotersRow}>
									{opt.voteGivers.slice(0, 5).map((voter) => (
										<span
											key={voter.id}
											className={s.pollVoterAvatar}
											title={voter.name}
										>
											{voter.photo ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={voter.photo}
													alt={voter.name}
													style={{ width: '100%', height: '100%', borderRadius: '50%' }}
												/>
											) : (
												voter.name.slice(0, 1).toUpperCase()
											)}
										</span>
									))}
									{opt.voteGivers.length > 5 && (
										<span className={s.pollVotersMore}>
											+{opt.voteGivers.length - 5}
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
					{fill(t('chatPollTotalVotes'), { n: poll.totalVote })}
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
