'use client';

import React from 'react';
import { Lightbulb, Archive, Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Project } from '@/db/schema';
import { MobileProjectCard } from './MobileProjectCard';
import s from './ProjectsMobile.module.css';

interface ShowcaseTabProps {
	isLoading: boolean;
	projects: Project[];
	query: string;
	onQueryChange: (q: string) => void;
	techs: string[];
	selectedTech: string | null;
	onSelectTech: (tech: string | null) => void;
	onOpenProject: (id: string) => void;
	onStarProject: (proj: Project) => void;
}

export function ProjectsMobileShowcaseTab({
	isLoading,
	projects,
	query,
	onQueryChange,
	techs,
	selectedTech,
	onSelectTech,
	onOpenProject,
	onStarProject,
}: ShowcaseTabProps) {
	const { t } = useI18n();
	return (
		<>
			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('pjSearchPlaceholder')}
					value={query}
					onChange={(e) => onQueryChange(e.target.value)}
				/>
			</div>

			{techs.length > 0 && (
				<div className={s.chipRow}>
					<button
						type="button"
						className={`${s.chip} ${selectedTech === null ? s.chipActive : ''}`}
						onClick={() => onSelectTech(null)}
					>
						{t('pjFilterAllTech')}
					</button>
					{techs.map((tItem) => (
						<button
							key={tItem}
							type="button"
							className={`${s.chip} ${selectedTech === tItem ? s.chipActive : ''}`}
							onClick={() => onSelectTech(selectedTech === tItem ? null : tItem)}
						>
							<span>{tItem}</span>
						</button>
					))}
				</div>
			)}

			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{isLoading ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{t('loading')}
					</div>
				) : projects.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{t('pjNoProjects')}
					</div>
				) : (
					projects.map((proj) => (
						<MobileProjectCard
							key={proj.id}
							proj={proj}
							onOpen={onOpenProject}
							onStar={onStarProject}
						/>
					))
				)}
			</div>
		</>
	);
}

interface StatusListTabProps {
	kind: 'proposals' | 'archive';
	isLoading: boolean;
	projects: Project[];
	onOpenProject: (id: string) => void;
	onStarProject: (proj: Project) => void;
}

export function ProjectsMobileStatusTab({
	kind,
	isLoading,
	projects,
	onOpenProject,
	onStarProject,
}: StatusListTabProps) {
	const { t } = useI18n();
	const isProposals = kind === 'proposals';
	const EmptyIcon = isProposals ? Lightbulb : Archive;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
					{t(isProposals ? 'pjTabProposals' : 'pjTabArchive')}
				</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t(isProposals ? 'pjProposalsDesc' : 'pjArchiveDesc')}
				</p>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{isLoading ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
						<div>{t('loading')}</div>
					</div>
				) : projects.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
						<EmptyIcon size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
						<div>{t(isProposals ? 'pjNoProposals' : 'pjNoArchive')}</div>
					</div>
				) : (
					projects.map((proj) => (
						<MobileProjectCard
							key={proj.id}
							proj={proj}
							onOpen={onOpenProject}
							onStar={onStarProject}
						/>
					))
				)}
			</div>
		</div>
	);
}
