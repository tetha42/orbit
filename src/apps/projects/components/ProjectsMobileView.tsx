'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
	FolderGit2,
	Lightbulb,
	Archive,
	PlusCircle,
	Search,
	Star,
	Users,
	ChevronRight,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { useProjects } from '../hooks/useProjects';
import type { Project } from '@/db/schema';
import { ProjectDetailModal } from './ProjectDetailModal';
import { ProjectFormModal } from './ProjectFormModal';
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
		() => p.allFiltered.filter((proj) => proj.status === 'yayinda'),
		[p.allFiltered]
	);

	const proposalProjects = useMemo(
		() => p.allFiltered.filter((proj) => proj.status === 'oneri'),
		[p.allFiltered]
	);

	const archiveProjects = useMemo(
		() => p.allFiltered.filter((proj) => proj.status === 'arsiv'),
		[p.allFiltered]
	);

	const handleTabChange = (tabId: ProjectsMobileTab) => {
		if (tabId === 'add') {
			p.setForm({ proje: null });
			return;
		}
		if (activeTab === tabId) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			if (tabId === 'showcase') p.setTab('yayinda');
			else if (tabId === 'proposals') p.setTab('oneri');
			else if (tabId === 'archive') p.setTab('arsiv');
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
			badgeCount: p.counts.oneri > 0 ? p.counts.oneri : undefined,
		},
		{ id: 'archive', label: t('pjMobTabArchive'), Icon: Archive },
		{ id: 'add', label: t('pjMobAddProject'), Icon: PlusCircle },
	];

	const renderProjectCard = (proj: Project) => {
		const isStarred = Boolean(proj.begendimMi);
		return (
			<div
				key={proj.id}
				className={s.projectCard}
				onClick={() => p.setOpenId(proj.id)}
			>
				<div className={s.projectHeader}>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div className={s.projectTitle}>{proj.baslik}</div>
						{proj.takimAdi && (
							<div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
								<Users size={11} />
								<span>{proj.takimAdi}</span>
							</div>
						)}
					</div>
					{proj.status === 'yayinda' && (
						<button
							type="button"
							className={`${s.starBtn} ${isStarred ? s.starBtnStarred : ''}`}
							onClick={(e) => {
								e.stopPropagation();
								void p.star(proj);
							}}
						>
							<Star size={13} fill={isStarred ? '#ffb340' : 'none'} strokeWidth={1.8} />
							<span>{proj.begeniSayisi ?? 0}</span>
						</button>
					)}
				</div>

				<div className={s.projectSummary}>{proj.ozet}</div>

				{proj.teknolojiler.length > 0 && (
					<div className={s.techRow}>
						{proj.teknolojiler.slice(0, 4).map((tech) => (
							<span key={tech} className={s.techPill}>
								{tech}
							</span>
						))}
						{proj.teknolojiler.length > 4 && (
							<span className={s.techPill} style={{ opacity: 0.5 }}>
								+{proj.teknolojiler.length - 4}
							</span>
						)}
					</div>
				)}

				<div className={s.metaRow}>
					<span style={{ opacity: 0.6 }}>{proj.olusturanAdSoyad || '—'}</span>
					<span style={{ color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
						<span>{t('details')}</span>
						<ChevronRight size={13} />
					</span>
				</div>
			</div>
		);
	};

	// 1. Showcase Tab Content
	const renderShowcase = () => (
		<>
			{/* Search Input */}
			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('pjSearchPlaceholder')}
					value={p.query}
					onChange={(e) => p.setQuery(e.target.value)}
				/>
			</div>

			{/* Technology Chips */}
			{p.techs.length > 0 && (
				<div className={s.chipRow}>
					<button
						type="button"
						className={`${s.chip} ${p.tech === null ? s.chipActive : ''}`}
						onClick={() => p.setTech(null)}
					>
						{t('pjFilterAllTech')}
					</button>
					{p.techs.map((tItem) => (
						<button
							key={tItem}
							type="button"
							className={`${s.chip} ${p.tech === tItem ? s.chipActive : ''}`}
							onClick={() => p.setTech(p.tech === tItem ? null : tItem)}
						>
							<span>{tItem}</span>
						</button>
					))}
				</div>
			)}

			{/* Projects List */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{p.data === null ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{t('loading')}
					</div>
				) : showcaseProjects.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{t('pjNoProjects')}
					</div>
				) : (
					showcaseProjects.map(renderProjectCard)
				)}
			</div>
		</>
	);

	// 2. Proposals Tab Content
	const renderProposals = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('pjTabProposals')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('pjProposalsDesc')}
				</p>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{p.data === null ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
						<div>{t('loading')}</div>
					</div>
				) : proposalProjects.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
						<Lightbulb size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
						<div>{t('pjNoProposals')}</div>
					</div>
				) : (
					proposalProjects.map(renderProjectCard)
				)}
			</div>
		</div>
	);

	// 3. Archive Tab Content
	const renderArchive = () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('pjTabArchive')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('pjArchiveDesc')}
				</p>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
				{p.data === null ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
						<div>{t('loading')}</div>
					</div>
				) : archiveProjects.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
						<Archive size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
						<div>{t('pjNoArchive')}</div>
					</div>
				) : (
					archiveProjects.map(renderProjectCard)
				)}
			</div>
		</div>
	);

	return (
		<div className={s.mobileRoot}>
			{/* Scrollable Content Area */}
			<div className={s.mobileScrollArea} ref={scrollAreaRef}>
				{activeTab === 'showcase' && renderShowcase()}
				{activeTab === 'proposals' && renderProposals()}
				{activeTab === 'archive' && renderArchive()}
			</div>

			{/* Fixed Apple iOS Bottom Tab Bar */}
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

			{/* Modals */}
			{p.open && (
				<ProjectDetailModal
					proje={p.open}
					currentUserId={p.currentUserId}
					manage={p.manage}
					onClose={() => p.setOpenId(null)}
					onOpenTeam={p.openTeam}
					onStar={() => void p.star(p.open!)}
					onEdit={() => {
						const current = p.open;
						p.setOpenId(null);
						p.setForm({ proje: current });
					}}
					onPatch={(body, msg) => p.patch(p.open!, body, msg)}
					onDelete={() => p.remove(p.open!)}
				/>
			)}

			{p.form && (
				<ProjectFormModal
					proje={p.form.proje}
					teams={p.teamOptions}
					manage={p.manage}
					onClose={() => p.setForm(null)}
					onSaved={async (proje) => {
						p.setForm(null);
						await p.refetch();
						p.setTab(proje.status);
					}}
				/>
			)}
		</div>
	);
}
