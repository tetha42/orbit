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
	proje: Project;
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

export function ProjectDetailModal({ proje, currentUserId, manage, onClose, onEdit, onStar, onPatch, onDelete, onOpenTeam }: Props) {
	const { t, language } = useI18n();
	const dialog = useDialog();
	const confirmOpen = useRef(false);
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';

	const owner = proje.olusturanId === currentUserId;
	const canEdit = manage || (owner && proje.status !== 'arsiv');
	const canDelete = manage || (owner && proje.status === 'oneri');
	const statusKey = proje.status === 'oneri' ? 'pjStatusOneri' : proje.status === 'arsiv' ? 'pjStatusArsiv' : 'pjStatusYayinda';

	const remove = async () => {
		confirmOpen.current = true;
		const ok = await dialog.confirm({ message: fill(t('pjDeleteConfirm'), { title: proje.baslik }), tone: 'danger' });
		confirmOpen.current = false;
		if (ok) await onDelete();
	};

	return (
		<Sheet
			label={proje.baslik}
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
					<h3 style={{ margin: 0, fontSize: 18, fontWeight: 760 }}>{proje.baslik}</h3>
					<div className={styles.cardTop} style={{ marginTop: 6 }}>
						<span className={`${styles.pill} ${styles[`pill_${proje.status}`]}`}>{t(statusKey)}</span>
						{Number(proje.oneCikan) === 1 && (
							<span className={`${styles.pill} ${styles.pillFeatured}`}>
								<Pin size={11} /> {t('pjFeatured')}
							</span>
						)}
						{proje.teamId && proje.takimAdi && (
							<button
								type="button"
								className={`${styles.pill} ${styles.pillTeam}`}
								onClick={() => onOpenTeam(proje.teamId!)}
								title={t('pjOpenTeam')}
							>
								<Users size={11} /> {proje.takimAdi}
							</button>
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
						{manage && proje.status === 'oneri' && (
							<button type="button" className={ui.primaryBtn} style={{ height: 30 }} onClick={() => onPatch({ status: 'yayinda' }, t('pjPublished'))}>
								<Send size={14} /> {t('pjActPublish')}
							</button>
						)}
						{manage && proje.status === 'yayinda' && (
							<>
								<button
									type="button"
									className={ui.btn}
									onClick={() => onPatch({ oneCikan: Number(proje.oneCikan) !== 1 }, t('pjSaved'))}
								>
									{Number(proje.oneCikan) === 1 ? <PinOff size={14} /> : <Pin size={14} />}
									{Number(proje.oneCikan) === 1 ? t('pjActUnpin') : t('pjActPin')}
								</button>
								<button type="button" className={ui.btn} onClick={() => onPatch({ status: 'oneri' }, t('pjSaved'))}>
									<Undo2 size={14} /> {t('pjActUnpublish')}
								</button>
								<button type="button" className={ui.btn} onClick={() => onPatch({ status: 'arsiv' }, t('pjSaved'))}>
									<Archive size={14} /> {t('pjActArchive')}
								</button>
							</>
						)}
						{manage && proje.status === 'arsiv' && (
							<button type="button" className={ui.btn} onClick={() => onPatch({ status: 'yayinda' }, t('pjSaved'))}>
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
			{proje.status === 'oneri' && <div className={styles.note}>{t('pjProposalNote')}</div>}
			{proje.status === 'arsiv' && <div className={styles.note}>{t('pjArchiveNote')}</div>}

			<div className={styles.detailHero}>
				<p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{proje.ozet}</p>
				<div className={styles.linkRow}>
					{proje.repoUrl && (
						<a className={`${styles.linkBtn} ${styles.linkBtnPrimary}`} href={proje.repoUrl} target="_blank" rel="noreferrer noopener">
							<FolderGit2 size={15} />
							{shortRepo(proje.repoUrl)}
						</a>
					)}
					{proje.canliUrl && (
						<a className={styles.linkBtn} href={proje.canliUrl} target="_blank" rel="noreferrer noopener">
							<ExternalLink size={15} />
							{t('pjDemo')}
						</a>
					)}
					<button
						type="button"
						className={`${styles.starBtn} ${proje.begendimMi ? styles.starBtnOn : ''}`}
						style={{ height: 34 }}
						disabled={proje.status !== 'yayinda'}
						aria-pressed={!!proje.begendimMi}
						onClick={onStar}
						title={proje.begendimMi ? t('pjUnstar') : t('pjStar')}
					>
						<Star size={15} fill={proje.begendimMi ? 'currentColor' : 'none'} />
						{proje.begeniSayisi ?? 0}
					</button>
				</div>
			</div>

			{proje.teknolojiler.length > 0 && (
				<div className={styles.techList}>
					{proje.teknolojiler.map((x) => (
						<span key={x} className={styles.tech}>
							{x}
						</span>
					))}
				</div>
			)}

			{proje.aciklama && (
				<div className={ui.descView}>
					<Linkified text={proje.aciklama} />
				</div>
			)}

			<div className={styles.author}>
				<span className={ui.avatar} style={{ marginLeft: 0, width: 26, height: 26, fontSize: 10.5 }}>
					{initials(proje.olusturanAdSoyad)}
				</span>
				<span style={{ fontSize: 12.5 }}>
					<strong>{proje.olusturanAdSoyad || '—'}</strong>
					<span className={ui.muted}>
						{' · '}
						{fill(t('pjAddedOn'), { date: new Date(proje.olusturma).toLocaleDateString(locale) })}
					</span>
				</span>
			</div>
		</Sheet>
	);
}
