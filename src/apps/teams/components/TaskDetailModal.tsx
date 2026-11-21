'use client';

import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n, getLocaleDefinition } from '@/core/i18n';
import { useJsonResource } from '@/core/data/useJsonResource';
import { relativeTime } from '@/core/data/format';
import { TITLE_MAX, dueStatus } from '@/lib/kanban';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';
import { columnMeta, type TeamTaskDetail } from '../types';
import { useNow } from '@/lib/client/useSheet';
import { ModalOverlay, useDraggableSheet } from '@/core/ui/Sheet';
import { TaskChecklist } from './TaskChecklist';
import { TaskComments } from './TaskComments';
import { TaskActivityHistory } from './TaskActivityHistory';
import { TaskMetaSidebar } from './TaskMetaSidebar';
import { TaskDescription } from './TaskDescription';
import { useTaskDetail } from '../hooks/useTaskDetail';

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
	const locale = getLocaleDefinition(language).dateLocale;
	const url = `/api/teams/tasks/${encodeURIComponent(taskId)}`;
	const { data, setData, refetch, httpStatus } = useJsonResource<TeamTaskDetail>(url);
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

	const { task, items, comments, activity, permissions } = data;
	const col = columnMeta(task.status);
	const due = dueStatus(task.dueDate, task.status, now);
	const doneItems = items.filter((m) => Number(m.isDone) === 1).length;
	const canClaim = !task.assigneeMemberId && !permissions.manage && members.some((m) => m.id === currentUserId);
	const when = (ts: number) => relativeTime(ts, now, language);

	return (
		<ModalOverlay onClose={onClose} pausedRef={confirmOpen}>
			<div
				className={ui.sheet}
				role="dialog"
				aria-modal="true"
				aria-label={task.title}
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
						value={titleDraft ?? task.title}
						disabled={!permissions.manage}
						maxLength={TITLE_MAX}
						aria-label={t('kbTitle')}
						onFocus={() => setTitleDraft(task.title)}
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
						{!permissions.work && !canClaim && <div className={ui.hint}>{t('kbReadOnly')}</div>}

						<TaskDescription
							description={task.description}
							canWork={permissions.work}
							descDraft={descDraft}
							setDescDraft={setDescDraft}
							onSaveDesc={saveDesc}
						/>

						<TaskChecklist
							items={items}
							doneItems={doneItems}
							canWork={permissions.work}
							itemDraft={itemDraft}
							setItemDraft={setItemDraft}
							onToggleItem={toggleItem}
							onDeleteItem={(id) => action({ action: 'deleteItem', itemId: id })}
							onAddItem={addItem}
						/>

						<TaskComments
							comments={comments}
							currentUserId={currentUserId}
							canManage={permissions.manage}
							canComment={permissions.comment}
							commentDraft={commentDraft}
							setCommentDraft={setCommentDraft}
							busy={busy}
							when={when}
							onSendComment={sendComment}
							onDeleteComment={deleteComment}
						/>

						<TaskActivityHistory activity={activity} members={members} when={when} />
					</div>

					<TaskMetaSidebar
						task={task}
						members={members}
						allLabels={allLabels}
						currentUserId={currentUserId}
						permissions={permissions}
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
