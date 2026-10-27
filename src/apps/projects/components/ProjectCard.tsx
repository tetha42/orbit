import React, { useMemo } from 'react';
import { ExternalLink, FolderGit2, Pin, Star, Users, Copy, Code } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import { initials } from '@/core/text/initials';
import type { Project } from '@/db/schema';
import ui from '@/core/ui/ui.module.css';
import styles from './Projects.module.css';

interface Props {
	project: Project;
	locale: string;
	onOpen: (id: string) => void;
	onOpenTeam: (teamId: string) => void;
	onStar: (project: Project) => void;
}

export function ProjectCard({ project: p, locale, onOpen, onOpenTeam, onStar }: Props) {
	const { t } = useI18n();
	const featured = Number(p.oneCikan) === 1;

	const menuItems = useMemo<MenuItem[]>(() => {
		const items: MenuItem[] = [
			{
				id: `pj-open-${p.id}`,
				label: t('ctxProjectsOpen'),
				icon: <Code size={13} />,
				action: () => onOpen(p.id),
			},
		];

		if (p.repoUrl) {
			items.push({
				id: `pj-copy-repo-${p.id}`,
				label: t('ctxProjectsCopyLink'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(p.repoUrl!);
				},
			});
		}

		if (p.teamId) {
			items.push(
				{ id: `sep-pj-${p.id}`, label: '', separator: true },
				{
					id: `pj-open-team-${p.id}`,
					label: t('pjOpenTeam'),
					icon: <Users size={13} />,
					action: () => onOpenTeam(p.teamId!),
				}
			);
		}

		return items;
	}, [p.id, p.repoUrl, p.teamId, t, onOpen, onOpenTeam]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<article
			data-project-id={p.id}
			className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}
			tabIndex={0}
			role="button"
			aria-label={p.baslik}
			{...contextMenuProps}
			onClick={() => onOpen(p.id)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onOpen(p.id);
				}
			}}
		>
			<div className={styles.cardTop}>
				{featured && (
					<span className={`${styles.pill} ${styles.pillFeatured}`}>
						<Pin size={11} /> {t('pjFeatured')}
					</span>
				)}
				{p.status !== 'yayinda' && (
					<span className={`${styles.pill} ${styles[`pill_${p.status}`]}`}>
						{t(p.status === 'oneri' ? 'pjStatusOneri' : 'pjStatusArsiv')}
					</span>
				)}
				{p.teamId && p.takimAdi && (
					<button
						type="button"
						className={`${styles.pill} ${styles.pillTeam}`}
						title={t('pjOpenTeam')}
						onClick={(e) => {
							e.stopPropagation();
							onOpenTeam(p.teamId!);
						}}
					>
						<Users size={11} /> {p.takimAdi}
					</button>
				)}
			</div>
			<h3 className={styles.cardTitle}>{p.baslik}</h3>
			<p className={styles.cardSummary}>{p.ozet}</p>
			{p.teknolojiler.length > 0 && (
				<div className={styles.techList}>
					{p.teknolojiler.slice(0, 5).map((x) => (
						<span key={x} className={styles.tech}>
							{x}
						</span>
					))}
					{p.teknolojiler.length > 5 && <span className={styles.tech}>+{p.teknolojiler.length - 5}</span>}
				</div>
			)}
			<div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
				<span className={styles.author} title={new Date(p.olusturma).toLocaleDateString(locale)}>
					<span className={ui.avatar} style={{ marginLeft: 0 }}>
						{initials(p.olusturanAdSoyad)}
					</span>
					<span>{p.olusturanAdSoyad || '—'}</span>
				</span>
				{p.repoUrl && (
					<a
						className={styles.linkIcon}
						href={p.repoUrl}
						target="_blank"
						rel="noreferrer noopener"
						title={t('pjRepo')}
						aria-label={t('pjRepo')}
					>
						<FolderGit2 size={15} />
					</a>
				)}
				{p.canliUrl && (
					<a
						className={styles.linkIcon}
						href={p.canliUrl}
						target="_blank"
						rel="noreferrer noopener"
						title={t('pjDemo')}
						aria-label={t('pjDemo')}
					>
						<ExternalLink size={15} />
					</a>
				)}
				<button
					type="button"
					className={`${styles.starBtn} ${p.begendimMi ? styles.starBtnOn : ''}`}
					disabled={p.status !== 'yayinda'}
					aria-pressed={!!p.begendimMi}
					title={p.begendimMi ? t('pjUnstar') : t('pjStar')}
					onClick={() => onStar(p)}
				>
					<Star size={13} fill={p.begendimMi ? 'currentColor' : 'none'} />
					{p.begeniSayisi ?? 0}
				</button>
			</div>
		</article>
	);
}
