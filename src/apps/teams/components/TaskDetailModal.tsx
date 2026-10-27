'use client';

import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { relativeTime } from '@/core/data/format';
import { BASLIK_MAX, teslimDurumu } from '@/lib/kanban';
import type { TeamTaskActivity, TeamTaskItem, TeamTaskComment } from '@/db/schema';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';
import { columnMeta, type TeamTask } from '../types';
import { useNow } from '@/lib/client/useSheet';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import { TaskChecklist } from './TaskChecklist';
import { TaskComments } from './TaskComments';
import { TaskActivityHistory } from './TaskActivityHistory';
import { TaskMetaSidebar } from './TaskMetaSidebar';
import { TaskDescription } from './TaskDescription';
import { useTaskDetail } from '../hooks/useTaskDetail';

interface Detail {
	task: TeamTask;
	maddeler: TeamTaskItem[];
	yorumlar: TeamTaskComment[];
	aktivite: TeamTaskActivity[];
	izinler: { manage: boolean; work: boolean; comment: boolean };
}

interface Props {
	taskId: string;
	currentUserId: string;
	members: { id: string; name: string; role: string }[];
	allLabels: string[];
	notify: (text: string, tone?: 'success' | 'error') => void;
	onClose: () => void;
	onChanged: () => Promise<void>;
}

export function TaskDetailModal({ taskId, currentUserId, members, allLabels, notify, onClose, onChanged }: Props) {
	const { t, language } = useI18n();
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';
	const url = `/api/teams/tasks/${encodeURIComponent(taskId)}`;
	const { data, setData, refetch, httpStatus } = useJsonResource<Detail>(url);
	const now = useNow();

	const confirmOpen = useRef(false);
	const { offset, dragging, onHeaderMouseDown, onHeaderDoubleClick } = useDraggableSheet(true);

	const {
		titleDraft,
		setTitleDraft,
		descDraft,
		setDescDraft,
		itemDraft,
		setItemDraft,
		commentDraft,
		setCommentDraft,
		busy,
		saveTitle,
		saveDesc,
		setStatus,
		toggleItem,
		addItem,
		sendComment,
		deleteComment,
		deleteTask,
		patch,
		action,
	} = useTaskDetail({
		url,
		data,
		setData,
		refetch,
		onChanged,
		notify,
		onClose,
		confirmOpenRef: confirmOpen,
	});

	if (!data) {
		return (
			<ModalOverlay onClose={onClose} pausedRef={confirmOpen}>
				<div className={`${ui.sheet} ${ui.sheetSmall}`} role="dialog" aria-modal="true" style={{ padding: 24 }}>
					<div className={httpStatus && httpStatus >= 400 ? ui.error : ui.muted}>
						{httpStatus && httpStatus >= 400 ? t('kbLoadFailed') : '…'}
					</div>
					{httpStatus && httpStatus >= 400 && (
						<div className={ui.btnRow} style={{ marginTop: 12 }}>
							<button type="button" className={ui.btn} onClick={onClose}>
								{t('kbClose')}
							</button>
						</div>
					)}
				</div>
			</ModalOverlay>
		);
	}

	const { task, maddeler, yorumlar, aktivite, izinler } = data;
	const col = columnMeta(task.status);
	const due = teslimDurumu(task.teslimTarihi, task.status, now);
	const doneItems = maddeler.filter((m) => Number(m.tamamMi) === 1).length;
	const canClaim = !task.atananUyeId && !izinler.manage && members.some((m) => m.id === currentUserId);
	const when = (ts: number) => relativeTime(ts, now, language === 'en' ? 'en' : 'tr');

	return (
		<ModalOverlay onClose={onClose} pausedRef={confirmOpen}>
			<div
				className={ui.sheet}
				role="dialog"
				aria-modal="true"
				aria-label={task.baslik}
				style={
					offset.x !== 0 || offset.y !== 0
						? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }
						: undefined
				}
			>
				<div
					className={`${ui.sheetHeader} ${ui.sheetHeaderDraggable}${dragging ? ` ${ui.sheetHeaderDragging}` : ''}`}
					onMouseDown={onHeaderMouseDown}
					onDoubleClick={onHeaderDoubleClick}
				>
					<span
						title={t(col.key)}
						style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }}
					/>
					<input
						className={styles.sheetTitleInput}
						value={titleDraft ?? task.baslik}
						disabled={!izinler.manage}
						maxLength={BASLIK_MAX}
						aria-label={t('kbTitle')}
						onFocus={() => setTitleDraft(task.baslik)}
						onChange={(e) => setTitleDraft(e.target.value)}
						onBlur={saveTitle}
						onKeyDown={(e) => {
							if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
						}}
					/>
					<button type="button" className={ui.iconBtn} style={{ marginLeft: 0 }} onClick={onClose} aria-label={t('kbClose')}>
						<X size={17} />
					</button>
				</div>

				<div className={styles.sheetBody}>
					<div className={ui.sheetMain}>
						{!izinler.work && !canClaim && <div className={ui.hint}>{t('kbReadOnly')}</div>}

						<TaskDescription
							aciklama={task.aciklama}
							canWork={izinler.work}
							descDraft={descDraft}
							setDescDraft={setDescDraft}
							onSaveDesc={saveDesc}
						/>

						<TaskChecklist
							maddeler={maddeler}
							doneItems={doneItems}
							canWork={izinler.work}
							itemDraft={itemDraft}
							setItemDraft={setItemDraft}
							onToggleItem={toggleItem}
							onDeleteItem={(id) => action({ action: 'deleteItem', maddeId: id })}
							onAddItem={addItem}
						/>

						<TaskComments
							yorumlar={yorumlar}
							currentUserId={currentUserId}
							canManage={izinler.manage}
							canComment={izinler.comment}
							commentDraft={commentDraft}
							setCommentDraft={setCommentDraft}
							busy={busy}
							when={when}
							onSendComment={sendComment}
							onDeleteComment={deleteComment}
						/>

						<TaskActivityHistory aktivite={aktivite} members={members} when={when} />
					</div>

					<TaskMetaSidebar
						task={task}
						members={members}
						allLabels={allLabels}
						currentUserId={currentUserId}
						izinler={izinler}
						canClaim={canClaim}
						due={due}
						locale={locale}
						when={when}
						onSetStatus={setStatus}
						onPatch={patch}
						onDeleteTask={deleteTask}
					/>
				</div>
			</div>
		</ModalOverlay>
	);
}
