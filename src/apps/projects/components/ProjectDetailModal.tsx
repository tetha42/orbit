'use client';

import React, { useRef } from 'react';
import { Archive, ArchiveRestore, ExternalLink, FolderGit2, Pencil, Pin, PinOff, Send, Star, Trash2, Undo2, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { Linkified } from '@/components/Common/Linkified';
import { Sheet } from '@/core/ui/Sheet';
import { fill } from '@/lib/text';
import { shortRepo } from '@/lib/projects';
import type { Project } from '@/db/schema';
import ui from '@/core/ui/ui.module.css';
import styles from './Projects.module.css';
import { initials } from '@/core/text/initials';

interface Props {
	project: Project;
	currentUserId: string;
	manage: boolean;
	onClose: () => void;
	onEdit: () => void;
	onStar: () => void;
	/** Publish, archive, pin… — management only. */
	onPatch: (body: Record<string, unknown>, success: string) => Promise<void>;
	onDelete: () => Promise<void>;
	onOpenTeam: (teamId: string) => void;
}

export function ProjectDetailModal({ project, currentUserId, manage, onClose, onEdit, onStar, onPatch, onDelete, onOpenTeam }: Props) {
	const { t, language } = useI18n();
	const dialog = useDialog();
	const confirmOpen = useRef(false);
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';

	const owner = project.creatorId === currentUserId;
	const canEdit = manage || (owner && project.status !== 'archived');
	const canDelete = manage || (owner && project.status === 'proposed');
	const statusKey = project.status === 'proposed' ? 'pjStatusOneri' : project.status === 'archived' ? 'pjStatusArsiv' : 'pjStatusYayinda';

	const remove = async () => {
		confirmOpen.current = true;
		const ok = await dialog.confirm({ message: fill(t('pjDeleteConfirm'), { title: project.title }), tone: 'danger' });
		confirmOpen.current = false;
		if (ok) await onDelete();
	};

	return (
		<Sheet
			label={project.title}
			wide
			maxWidth={760}
			onClose={onClose}
			pausedRef={confirmOpen}
			closeLabel={t('pjClose')}
			icon={
				<div className={styles.brandIcon} style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}>
					<FolderGit2 size={18} />
				</div>
			}
			header={
				<div style={{ flex: 1, minWidth: 0 }}>
					<h3 style={{ margin: 0, fontSize: 18, fontWeight: 760 }}>{project.title}</h3>
					<div className={styles.cardTop} style={{ marginTop: 6 }}>
						<span className={`${styles.pill} ${styles[`pill_${project.status}`]}`}>{t(statusKey)}</span>
						{Number(project.oneLeaving) === 1 && (
							<span className={`${styles.pill} ${styles.pillFeatured}`}>
								<Pin size={11} /> {t('pjFeatured')}
							</span>
						)}
						{project.teamId && project.teamName && (
							<button
								type="button"
								className={`${styles.pill} ${styles.pillTeam}`}
								onClick={() => onOpenTeam(project.teamId!)}
								title={t('pjOpenTeam')}
							>
								<Users size={11} /> {project.teamName}
							</button>
						)}
						{(project.ownerUserNameSurname || project.ownerTeamName) && (
							<span className={styles.pill} title={t('pjOwner')}>
								{t('pjOwner')}: {project.ownerUserNameSurname || project.ownerTeamName}
							</span>
						)}
					</div>
				</div>
			}
			footer={
				canEdit || canDelete || manage ? (
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%', alignItems: 'center' }}>
						{canEdit && (
							<button type="button" className={ui.btn} onClick={onEdit}>
								<Pencil size={14} /> {t('pjActEdit')}
							</button>
						)}
						{manage && project.status === 'proposed' && (
							<button type="button" className={ui.primaryBtn} style={{ height: 30 }} onClick={() => onPatch({ status: 'published' }, t('pjPublished'))}>
								<Send size={14} /> {t('pjActPublish')}
							</button>
						)}
						{manage && project.status === 'published' && (
							<>
								<button
									type="button"
									className={ui.btn}
									onClick={() => onPatch({ oneLeaving: Number(project.oneLeaving) !== 1 }, t('pjSaved'))}
								>
									{Number(project.oneLeaving) === 1 ? <PinOff size={14} /> : <Pin size={14} />}
									{Number(project.oneLeaving) === 1 ? t('pjActUnpin') : t('pjActPin')}
								</button>
								<button type="button" className={ui.btn} onClick={() => onPatch({ status: 'proposed' }, t('pjSaved'))}>
									<Undo2 size={14} /> {t('pjActUnpublish')}
								</button>
								<button type="button" className={ui.btn} onClick={() => onPatch({ status: 'archived' }, t('pjSaved'))}>
									<Archive size={14} /> {t('pjActArchive')}
								</button>
							</>
						)}
						{manage && project.status === 'archived' && (
							<button type="button" className={ui.btn} onClick={() => onPatch({ status: 'published' }, t('pjSaved'))}>
								<ArchiveRestore size={14} /> {t('pjActRestore')}
							</button>
						)}
						{canDelete && (
							<button type="button" className={`${ui.btn} ${ui.btnDanger}`} style={{ marginLeft: 'auto' }} onClick={remove}>
								<Trash2 size={14} /> {t('pjActDelete')}
							</button>
						)}
					</div>
				) : undefined
			}
		>
			{project.status === 'proposed' && <div className={styles.note}>{t('pjProposalNote')}</div>}
			{project.status === 'archived' && <div className={styles.note}>{t('pjArchiveNote')}</div>}

			<div className={styles.detailHero}>
				<p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{project.summary}</p>
				<div className={styles.linkRow}>
					{project.repoUrl && (
						<a className={`${styles.linkBtn} ${styles.linkBtnPrimary}`} href={project.repoUrl} target="_blank" rel="noreferrer noopener">
							<FolderGit2 size={15} />
							{shortRepo(project.repoUrl)}
						</a>
					)}
					{project.liveUrl && (
						<a className={styles.linkBtn} href={project.liveUrl} target="_blank" rel="noreferrer noopener">
							<ExternalLink size={15} />
							{t('pjDemo')}
						</a>
					)}
					<button
						type="button"
						className={`${styles.starBtn} ${project.likedByMe ? styles.starBtnOn : ''}`}
						style={{ height: 34 }}
						disabled={project.status !== 'published'}
						aria-pressed={!!project.likedByMe}
						onClick={onStar}
						title={project.likedByMe ? t('pjUnstar') : t('pjStar')}
					>
						<Star size={15} fill={project.likedByMe ? 'currentColor' : 'none'} />
						{project.likeCount ?? 0}
					</button>
				</div>
			</div>

			{project.technologies.length > 0 && (
				<div className={styles.techList}>
					{project.technologies.map((x) => (
						<span key={x} className={styles.tech}>
							{x}
						</span>
					))}
				</div>
			)}

			{project.description && (
				<div className={ui.descView}>
					<Linkified text={project.description} />
				</div>
			)}

			<div className={styles.author}>
				<span className={ui.avatar} style={{ marginLeft: 0, width: 26, height: 26, fontSize: 10.5 }}>
					{initials(project.creatorNameSurname)}
				</span>
				<span style={{ fontSize: 12.5 }}>
					<strong>{project.creatorNameSurname || '—'}</strong>
					<span className={ui.muted}>
						{' · '}
						{fill(t('pjAddedOn'), { date: new Date(project.creation).toLocaleDateString(locale) })}
					</span>
				</span>
			</div>
		</Sheet>
	);
}
