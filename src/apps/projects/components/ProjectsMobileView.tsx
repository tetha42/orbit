'use client';

import React, { useState, useRef, useMemo } from 'react';
import { FolderGit2, Lightbulb, Archive, PlusCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { useProjects } from '../hooks/useProjects';
import { ProjectDetailModal } from './ProjectDetailModal';
import { ProjectFormModal } from './ProjectFormModal';
import { ProjectsMobileShowcaseTab, ProjectsMobileStatusTab } from './ProjectsMobileViewTabs';
import s from './ProjectsMobile.module.css';

export interface ProjectsMobileViewProps {
	p: ReturnType<typeof useProjects>;
}

type ProjectsMobileTab = 'showcase' | 'proposals' | 'archive' | 'add';

export function ProjectsMobileView({ p }: ProjectsMobileViewProps) {
	const { t } = useI18n();
	const [activeTab, setActiveTab] = useState<ProjectsMobileTab>('showcase');
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	const showcaseProjects = useMemo(
		() => p.allFiltered.filter((proj) => proj.status === 'published'),
		[p.allFiltered]
	);

	const proposalProjects = useMemo(
		() => p.allFiltered.filter((proj) => proj.status === 'proposed'),
		[p.allFiltered]
	);

	const archiveProjects = useMemo(
		() => p.allFiltered.filter((proj) => proj.status === 'archived'),
		[p.allFiltered]
	);

	const handleTabChange = (tabId: ProjectsMobileTab) => {
		if (tabId === 'add') {
			p.setForm({ project: null });
			return;
		}
		if (activeTab === tabId) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			if (tabId === 'showcase') p.setTab('published');
			else if (tabId === 'proposals') p.setTab('proposed');
			else if (tabId === 'archive') p.setTab('archived');
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	const tabs: Array<{
		id: ProjectsMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{ id: 'showcase', label: t('pjMobTabShowcase'), Icon: FolderGit2 },
		{
			id: 'proposals',
			label: t('pjMobTabProposals'),
			Icon: Lightbulb,
			badgeCount: p.counts.proposed > 0 ? p.counts.proposed : undefined,
		},
		{ id: 'archive', label: t('pjMobTabArchive'), Icon: Archive },
		{ id: 'add', label: t('pjMobAddProject'), Icon: PlusCircle },
	];

	const handleStarProject = (item: Parameters<typeof p.star>[0]) => void p.star(item);

	return (
		<div className={s.mobileRoot}>
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'showcase' && (
					<ProjectsMobileShowcaseTab
						isLoading={p.data === null}
						projects={showcaseProjects}
						query={p.query}
						onQueryChange={p.setQuery}
						techs={p.techs}
						selectedTech={p.tech}
						onSelectTech={p.setTech}
						onOpenProject={p.setOpenId}
						onStarProject={handleStarProject}
					/>
				)}
				{activeTab === 'proposals' && (
					<ProjectsMobileStatusTab
						kind="proposals"
						isLoading={p.data === null}
						projects={proposalProjects}
						onOpenProject={p.setOpenId}
						onStarProject={handleStarProject}
					/>
				)}
				{activeTab === 'archive' && (
					<ProjectsMobileStatusTab
						kind="archive"
						isLoading={p.data === null}
						projects={archiveProjects}
						onOpenProject={p.setOpenId}
						onStarProject={handleStarProject}
					/>
				)}
			</div>

			<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('pjMobNavAria')}>
				{tabs.map((tab) => {
					const activeTabMatched = activeTab === tab.id;
					const IconComponent = tab.Icon;
					const isAdd = tab.id === 'add';
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={activeTabMatched}
							className={`${s.mobileBottomTabBtn} ${activeTabMatched ? s.mobileBottomTabBtnActive : ''}`}
							onClick={() => handleTabChange(tab.id)}
							title={tab.label}
							style={isAdd ? { color: 'var(--accent)' } : undefined}
						>
							<div className={s.mobileBottomTabIconWrap}>
								<IconComponent size={20} strokeWidth={activeTabMatched ? 2.3 : 1.7} />
								{tab.badgeCount !== undefined && (
									<span className={s.tabBadge}>{tab.badgeCount}</span>
								)}
							</div>
							<span className={s.mobileBottomTabLabel}>{tab.label}</span>
						</button>
					);
				})}
			</nav>

			{p.open && (
				<ProjectDetailModal
					project={p.open}
					currentUserId={p.currentUserId}
					manage={p.manage}
					onClose={() => p.setOpenId(null)}
					onOpenTeam={p.openTeam}
					onStar={() => void p.star(p.open!)}
					onEdit={() => {
						const current = p.open;
						p.setOpenId(null);
						p.setForm({ project: current });
					}}
					onPatch={(body, msg) => p.patch(p.open!, body, msg)}
					onDelete={() => p.remove(p.open!)}
				/>
			)}

			{p.form && (
				<ProjectFormModal
					project={p.form.project}
					teams={p.teamOptions}
					manage={p.manage}
					onClose={() => p.setForm(null)}
					onSaved={async (project) => {
						p.setForm(null);
						await p.refetch();
						p.setTab(project.status);
					}}
				/>
			)}
		</div>
	);
}
