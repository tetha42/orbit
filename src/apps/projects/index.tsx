'use client';

import React from 'react';
import { FolderGit2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { useToast } from '@/core/ui/Toast';
import { useIsMobile } from '@/lib/client/useClientValue';
import ui from '@/core/ui/ui.module.css';
import styles from './components/Projects.module.css';
import { useProjects } from './hooks/useProjects';
import { ProjectsHeader } from './components/ProjectsHeader';
import { ProjectsToolbar } from './components/ProjectsToolbar';
import { ProjectCard } from './components/ProjectCard';
import { ProjectKanbanBoard } from './components/ProjectKanbanBoard';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { ProjectFormModal } from './components/ProjectFormModal';
import { ProjectsMobileView } from './components/ProjectsMobileView';
import type { ProjectStatus } from '@/lib/projects';
import type { ViewMode } from './types';

export function ProjectsApp() {
	const isMobile = useIsMobile();
	const p = useProjects();
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const notify = useToast();
	const locale = language === 'en' ? 'en-GB' : 'tr-TR';
	const [viewMode, setViewMode] = React.useState<ViewMode>('grid');

	if (isMobile) {
		return <ProjectsMobileView p={p} />;
	}

	const tabs: { id: ProjectStatus; label: string; count: number; show: boolean }[] = [
		{ id: 'yayinda', label: t('pjTabShowcase'), count: p.counts.yayinda, show: true },
		{ id: 'oneri', label: t('pjTabProposals'), count: p.counts.oneri, show: p.manage || p.counts.oneri > 0 },
		{ id: 'arsiv', label: t('pjTabArchive'), count: p.counts.arsiv, show: p.counts.arsiv > 0 },
	];

	return (
		<div className={styles.root}>
			<ProjectsHeader
				manage={p.manage}
				countYayinda={p.counts.yayinda}
				onOpenForm={() => p.setForm({ proje: null })}
			/>

			<ProjectsToolbar
				tabs={tabs}
				activeTab={p.tab}
				onSelectTab={p.setTab}
				query={p.query}
				onQueryChange={p.setQuery}
				sort={p.sort}
				onSortChange={p.setSort}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				techs={p.techs}
				activeTech={p.tech}
				onSelectTech={p.setTech}
			/>

			{p.data === null && (p.error || (p.httpStatus && p.httpStatus >= 400)) ? (
				<div className={styles.emptyState}>
					{t('pjLoadFailed')}
					<button type="button" className={ui.btn} onClick={() => p.refetch()}>
						{t('pjRetry')}
					</button>
				</div>
			) : p.data === null ? (
				<div className={styles.emptyState}>
					<span>{t('loading')}</span>
				</div>
			) : p.visible.length === 0 ? (
				<div className={styles.emptyState}>
					<FolderGit2 size={30} />
					<strong>{p.tab === 'oneri' ? t('pjEmptyProposals') : t('pjEmpty')}</strong>
					{p.tab === 'yayinda' && !p.query && <span>{t('pjEmptyHint')}</span>}
				</div>
			) : viewMode === 'kanban' ? (
				<ProjectKanbanBoard
					projects={p.allFiltered}
					locale={locale}
					onOpen={(id) => p.setOpenId(id)}
					onOpenTeam={p.openTeam}
					onStar={p.star}
				/>
			) : (
				<div className={styles.grid}>
					{p.visible.map((proj) => (
						<ProjectCard
							key={proj.id}
							project={proj}
							locale={locale}
							onOpen={(id) => p.setOpenId(id)}
							onOpenTeam={p.openTeam}
							onStar={p.star}
						/>
					))}
				</div>
			)}

			{p.open && (
				<ProjectDetailModal
					proje={p.open}
					currentUserId={p.currentUserId}
					manage={p.manage}
					onClose={() => p.setOpenId(null)}
					onEdit={() => p.setForm({ proje: p.open })}
					onStar={() => p.star(p.open!)}
					onPatch={(body, success) => p.patch(p.open!, body, success)}
					onDelete={() => p.remove(p.open!)}
					onOpenTeam={p.openTeam}
				/>
			)}

			{p.form && (
				<ProjectFormModal
					proje={p.form.proje}
					teams={p.teamOptions}
					manage={p.manage}
					onClose={() => p.setForm(null)}
					onSaved={async (saved, created) => {
						p.setForm(null);
						playSystemSound();
						notify(
							created
								? saved.status === 'yayinda'
									? t('pjPublished')
									: t('pjProposalSent')
								: t('pjSaved')
						);
						await p.refetch();
						p.setTab(saved.status);
						p.setOpenId(saved.id);
					}}
				/>
			)}
		</div>
	);
}
