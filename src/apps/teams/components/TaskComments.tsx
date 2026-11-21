'use client';

import React from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { COMMENT_MAX } from '@/lib/kanban';
import { Linkified } from '@/components/Common/Linkified';
import { initials } from '@/core/text/initials';
import type { TeamTaskComment } from '@/db/schema';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';

interface TaskCommentsProps {
	comments: TeamTaskComment[];
	currentUserId: string;
	canManage: boolean;
	canComment: boolean;
	commentDraft: string;
	setCommentDraft: React.Dispatch<React.SetStateAction<string>>;
	busy: boolean;
	when: (ts: number) => string;
	onSendComment: () => void;
	onDeleteComment: (y: TeamTaskComment) => void;
}

export function TaskComments({
	comments,
	currentUserId,
	canManage,
	canComment,
	commentDraft,
	setCommentDraft,
	busy,
	when,
	onSendComment,
	onDeleteComment,
}: TaskCommentsProps) {
	const { t } = useI18n();

	return (
		<section>
			<h5 className={ui.sectionTitle}>
				<MessageSquare size={13} />
				{t('kbComments')}
				{comments.length > 0 && <span style={{ marginLeft: 'auto' }}>{comments.length}</span>}
			</h5>
			{comments.length === 0 && <div className={ui.muted}>{t('kbNoComments')}</div>}
			{comments.map((y) => (
				<div key={y.id} className={styles.comment} data-comment-id={y.id}>
					<span className={ui.avatar} style={{ marginLeft: 0, width: 28, height: 28, fontSize: 11 }}>
						{initials(y.userName)}
					</span>
					<div className={styles.commentBody}>
						<div className={styles.commentHead}>
							<strong>{y.userName || t('kbSomeone')}</strong>
							<time className={ui.muted} style={{ fontSize: 11 }} dateTime={new Date(y.createdAt ?? 0).toISOString()}>
								{when(y.createdAt ?? 0)}
							</time>
							{(y.userId === currentUserId || canManage) && (
								<button
									type="button"
									className={styles.rowDelete}
									aria-label={t('delete', 'Sil')}
									onClick={() => onDeleteComment(y)}
								>
									<Trash2 size={13} />
								</button>
							)}
						</div>
						<div className={styles.commentText}>
							<Linkified text={y.content} />
						</div>
					</div>
				</div>
			))}
			{canComment && (
				<div style={{ marginTop: 8 }}>
					<textarea
						className={ui.textarea}
						style={{ minHeight: 60 }}
						rows={2}
						value={commentDraft}
						maxLength={COMMENT_MAX}
						placeholder={t('kbCommentPh')}
						onChange={(e) => setCommentDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
								e.preventDefault();
								void onSendComment();
							}
						}}
					/>
					<div className={ui.btnRow} style={{ marginTop: 6 }}>
						<button
							type="button"
							className={ui.primaryBtn}
							style={{ height: 30 }}
							disabled={!commentDraft.trim() || busy}
							onClick={onSendComment}
						>
							{t('kbSend')}
						</button>
					</div>
				</div>
			)}
		</section>
	);
}
