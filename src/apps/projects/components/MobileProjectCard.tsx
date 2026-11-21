'use client';

import React from 'react';
import { ChevronRight, Star, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Project } from '@/db/schema';
import s from './ProjectsMobile.module.css';

interface MobileProjectCardProps {
	proj: Project;
	onOpen: (id: string) => void;
	onStar: (proj: Project) => void;
}

export function MobileProjectCard({ proj, onOpen, onStar }: MobileProjectCardProps) {
	const { t } = useI18n();
	const isStarred = Boolean(proj.likedByMe);

	return (
		<div className={s.projectCard} onClick={() => onOpen(proj.id)}>
			<div className={s.projectHeader}>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className={s.projectTitle}>{proj.title}</div>
					{proj.teamName && (
						<div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
							<Users size={11} />
							<span>{proj.teamName}</span>
						</div>
					)}
				</div>
				{proj.status === 'published' && (
					<button
						type="button"
						className={`${s.starBtn} ${isStarred ? s.starBtnStarred : ''}`}
						onClick={(e) => {
							e.stopPropagation();
							onStar(proj);
						}}
					>
						<Star size={13} fill={isStarred ? 'var(--warning)' : 'none'} strokeWidth={1.8} />
						<span>{proj.likeCount ?? 0}</span>
					</button>
				)}
			</div>

			<div className={s.projectSummary}>{proj.summary}</div>

			{proj.technologies.length > 0 && (
				<div className={s.techRow}>
					{proj.technologies.slice(0, 4).map((tech) => (
						<span key={tech} className={s.techPill}>
							{tech}
						</span>
					))}
					{proj.technologies.length > 4 && (
						<span className={s.techPill} style={{ opacity: 0.5 }}>
							+{proj.technologies.length - 4}
						</span>
					)}
				</div>
			)}

			<div className={s.metaRow}>
				<span style={{ opacity: 0.6 }}>{proj.creatorName || '—'}</span>
				<span style={{ color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
					<span>{t('details')}</span>
					<ChevronRight size={13} />
				</span>
			</div>
		</div>
	);
}
