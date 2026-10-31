'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
	Search,
	X,
	Plus,
	Users,
	User,
	ChevronRight,
	Columns3,
	MessageSquare,
	Wallet,
	Settings,
	ChevronLeft,
	Clock,
	CheckSquare,
	Layers,
	PlusCircle,
	Compass,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { useToast } from '@/core/ui/Toast';
import { useNow } from '@/lib/client/useSheet';
import { sendJson } from '@/core/data/http';
import { dueStatus } from '@/lib/kanban';
import { COLUMNS, priorityMeta, columnMeta, type TaskStatus, type TeamTask } from '../types';
import type { useTeams } from '../hooks/useTeams';
import { TeamJoinButton } from './TeamJoinButton';
import { LockedTeamView } from './LockedTeamView';
import { TeamMembers } from './TeamMembers';
import { TeamChatRoom } from './TeamChatRoom';
import { VaultPanel } from '@/apps/budget/components/KasaPanel';
import { TaskDetailModal } from './TaskDetailModal';
import { NewTaskModal } from './NewTaskModal';
import { EditTeamModal, NewTeamModal, ApplyModal } from './TeamDialogs';
import s from './TeamsMobile.module.css';

export interface TeamsMobileViewProps {
	state: ReturnType<typeof useTeams>;
}

type TeamsMobileTab = 'discover' | 'my_teams' | 'board' | 'add';
type MobileWorkspaceTab = 'kanban' | 'members' | 'chat' | 'kasa';

export function TeamsMobileView({ state }: TeamsMobileViewProps) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const notify = useToast();
	const now = useNow(30_000);

	const [activeTab, setActiveTab] = useState<TeamsMobileTab>('discover');
	const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<MobileWorkspaceTab>('kanban');
	const [selectedKanbanCol, setSelectedKanbanCol] = useState<TaskStatus>('yapilacak');
	const [newTaskCol, setNewTaskCol] = useState<TaskStatus | null>(null);
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	// User's joined or captained teams
	const myTeamsList = useMemo(
		() =>
			state.visibleTeams.filter(
				(tm) => tm.benimDurumum === 'aktif' || tm.liderId === state.currentUserId
			),
		[state.visibleTeams, state.currentUserId]
	);

	// The active team displayed in the Board tab
	const activeBoardTeam = useMemo(() => {
		if (state.selectedTeam) return state.selectedTeam;
		if (myTeamsList.length > 0) return myTeamsList[0];
		if (state.teams.length > 0) return state.teams[0];
		return null;
	}, [state.selectedTeam, myTeamsList, state.teams]);

	const teamTasks = useMemo(
		() => activeBoardTeam?.gorevler ?? [],
		[activeBoardTeam?.gorevler]
	);

	const tasksByCol = useMemo(() => {
		const map = new Map<TaskStatus, TeamTask[]>();
		for (const col of COLUMNS) {
			map.set(
				col.id,
				teamTasks.filter((task) => task.status === col.id)
			);
		}
		return map;
	}, [teamTasks]);

	const canManageTeam = Boolean(
		activeBoardTeam &&
			(activeBoardTeam.izinler?.editAll || activeBoardTeam.liderId === state.currentUserId)
	);

	const canWorkOnTask = (task: TeamTask) =>
		canManageTeam || task.atananUyeId === state.currentUserId;

	const handleStepTask = async (task: TeamTask, delta: -1 | 1) => {
		const currentIndex = COLUMNS.findIndex((c) => c.id === task.status);
		if (currentIndex < 0) return;
		const targetIndex = currentIndex + delta;
		if (targetIndex < 0 || targetIndex >= COLUMNS.length) return;
		const nextStatus = COLUMNS[targetIndex].id;

		// Optimistic update
		state.setTeamsData((prev) =>
			prev
				? prev.map((tm) =>
						tm.id === task.teamId
							? {
									...tm,
									gorevler: (tm.gorevler ?? []).map((g) =>
										g.id === task.id ? { ...g, status: nextStatus } : g
									),
							  }
							: tm
				  )
				: prev
		);

		const res = await sendJson<{ ok: boolean; xpVerildi?: boolean; error?: string }>(
			'/api/teams',
			'POST',
			{
				action: 'updateTask',
				gorevId: task.id,
				status: nextStatus,
			}
		);

		if (!res.ok) {
			notify(res.error || t('kbMoveFailed'), 'error');
			await state.fetchTeams();
		} else {
			playSystemSound();
			if (res.data?.xpVerildi) {
				notify(t('kbRewardXp'));
			}
		}
	};

	const members = useMemo(
		() =>
			(activeBoardTeam?.uyeler ?? []).map((u) => ({
				id: u.userId,
				name: u.kullaniciAdSoyad,
				role: u.takimRolu,
			})),
		[activeBoardTeam?.uyeler]
	);

	const allLabels = useMemo(() => {
		const set = new Set<string>();
		for (const g of teamTasks) for (const l of g.etiketler ?? []) set.add(l);
		return Array.from(set).sort();
	}, [teamTasks]);

	const dueText = (stateDue: ReturnType<typeof dueStatus>, ts: number) => {
		if (stateDue === 'gecikti') return t('kbDueOverdue');
		if (stateDue === 'bugun') return t('kbDueToday');
		return new Date(ts).toLocaleDateString(language === 'en' ? 'en-GB' : 'tr-TR', {
			day: 'numeric',
			month: 'short',
		});
	};

	const handleTabChange = (tabId: TeamsMobileTab) => {
		if (tabId === 'add') {
			if (state.canCreateTeam) {
				state.setCreating(true);
			} else {
				notify(t('tmNoPermissionCreateTeam'), 'error');
			}
			return;
		}
		if (activeTab === tabId) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	const tabs: Array<{
		id: TeamsMobileTab;
		label: string;
		badgeCount?: number;
		Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
	}> = [
		{
			id: 'discover',
			label: t('tmMobTabDiscover'),
			Icon: Compass,
		},
		{
			id: 'my_teams',
			label: t('tmMobTabMyTeams'),
			Icon: Users,
			badgeCount: myTeamsList.length > 0 ? myTeamsList.length : undefined,
		},
		{
			id: 'board',
			label: t('tmMobTabBoard'),
			Icon: Columns3,
		},
		{
			id: 'add',
			label: t('tmMobTabAdd'),
			Icon: PlusCircle,
		},
	];

	const renderTeamCard = (team: (typeof state.visibleTeams)[number]) => {
		const isMember = team.benimDurumum === 'aktif';
		const hasApplied = team.benimDurumum === 'basvurdu';
		const canEnter = state.canEnter(team);

		return (
			<div
				key={team.id}
				className={s.teamCard}
				onClick={() => {
					if (canEnter) {
						state.showTeam(team.id);
						setActiveWorkspaceTab('kanban');
						setActiveTab('board');
					}
				}}
			>
				<div className={s.teamCardHeader}>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div className={s.teamName}>{team.ad}</div>
						<div className={s.teamLeaderRow} style={{ marginTop: '4px' }}>
							<User size={12} />
							<span>{team.liderAdSoyad || t('tmNoCaptain')}</span>
						</div>
					</div>
					<span className={s.categoryBadge}>{team.kategori}</span>
				</div>

				{team.aciklama && <div className={s.teamDesc}>{team.aciklama}</div>}

				<div className={s.teamMetaRow}>
					<span className={s.quotaPill}>
						<Users size={12} />
						<span>
							{team.doluKontenjan}/{team.kontenjan} {t('tmQuota')}
						</span>
					</span>

					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						{isMember ? (
							<button
								type="button"
								className={s.enterBtn}
								onClick={(e) => {
									e.stopPropagation();
									state.showTeam(team.id);
									setActiveWorkspaceTab('kanban');
									setActiveTab('board');
								}}
							>
								<span>{t('tmOpen')}</span>
								<ChevronRight size={13} />
							</button>
						) : hasApplied ? (
							<span style={{ fontSize: '11px', color: '#ff9f0a', fontWeight: 600 }}>
								{t('tmApplied')}
							</span>
						) : (
							<div onClick={(e) => e.stopPropagation()}>
								<TeamJoinButton
									team={team}
									currentUserId={state.currentUserId}
									busy={state.busy}
									myTeams={state.myTeams}
									onJoin={state.join}
									onLeave={state.leave}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className={s.mobileRoot}>
			<div ref={scrollAreaRef} className={s.mobileScrollArea}>
				{/* ================================================================= */}
				{/* TAB 1: KEŞFET (DISCOVER - ALL TEAMS)                              */}
				{/* ================================================================= */}
				{activeTab === 'discover' && (
					<>
						{/* Header */}
						<div className={s.headerBox}>
							<div className={s.headerTop}>
								<h1 className={s.title}>{t('tmTitle')}</h1>
								{state.canCreateTeam && (
									<button
										type="button"
										className={s.newTeamBtn}
										onClick={() => state.setCreating(true)}
									>
										<Plus size={15} />
										<span>{t('tmNewTeam')}</span>
									</button>
								)}
							</div>
							<p className={s.subtitle}>
								{state.teams.length} {t('tmStatTeams')} • {state.myTeams} {t('tmStatMine')}
							</p>
						</div>

						{/* Search */}
						<div className={s.searchBox}>
							<Search size={15} className={s.searchIcon} />
							<input
								type="text"
								className={s.searchInput}
								placeholder={t('tmSearch')}
								value={state.query}
								onChange={(e) => state.setQuery(e.target.value)}
							/>
							{state.query && (
								<button
									type="button"
									className={s.clearSearchBtn}
									onClick={() => state.setQuery('')}
								>
									<X size={14} />
								</button>
							)}
						</div>

						{/* Category Filter Pills */}
						<div className={s.filterScrollRow}>
							<button
								type="button"
								className={`${s.filterPill} ${!state.category ? s.filterPillActive : ''}`}
								onClick={() => state.setCategory(null)}
							>
								<Layers size={13} />
								<span>{t('tmAllCategories')}</span>
							</button>
							{state.categories.map((cat) => (
								<button
									key={cat}
									type="button"
									className={`${s.filterPill} ${state.category === cat ? s.filterPillActive : ''}`}
									onClick={() => state.setCategory(state.category === cat ? null : cat)}
								>
									<span>{cat}</span>
								</button>
							))}
						</div>

						{/* Team Cards List */}
						<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
							{state.visibleTeams.length === 0 ? (
								<div className={s.emptyCard}>
									<Users size={32} opacity={0.4} />
									<div style={{ fontWeight: 600, fontSize: '13.5px' }}>
										{state.teams.length ? t('tmNoMatch') : t('tmNoTeams')}
									</div>
								</div>
							) : (
								state.visibleTeams.map(renderTeamCard)
							)}
						</div>
					</>
				)}

				{/* ================================================================= */}
				{/* TAB 2: TAKIMLARIM (MY TEAMS)                                      */}
				{/* ================================================================= */}
				{activeTab === 'my_teams' && (
					<>
						{/* Header */}
						<div className={s.headerBox}>
							<div className={s.headerTop}>
								<h1 className={s.title}>{t('tmMobTabMyTeams')}</h1>
								{state.canCreateTeam && (
									<button
										type="button"
										className={s.newTeamBtn}
										onClick={() => state.setCreating(true)}
									>
										<Plus size={15} />
										<span>{t('tmNewTeam')}</span>
									</button>
								)}
							</div>
							<p className={s.subtitle}>
								{myTeamsList.length} {t('tmStatMine')}
							</p>
						</div>

						{/* Search */}
						<div className={s.searchBox}>
							<Search size={15} className={s.searchIcon} />
							<input
								type="text"
								className={s.searchInput}
								placeholder={t('tmSearch')}
								value={state.query}
								onChange={(e) => state.setQuery(e.target.value)}
							/>
							{state.query && (
								<button
									type="button"
									className={s.clearSearchBtn}
									onClick={() => state.setQuery('')}
								>
									<X size={14} />
								</button>
							)}
						</div>

						{/* My Teams List */}
						<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
							{myTeamsList.length === 0 ? (
								<div className={s.emptyCard}>
									<Users size={32} opacity={0.4} />
									<div style={{ fontWeight: 700, fontSize: '15px' }}>{t('tmMobNoMyTeams')}</div>
									<div style={{ opacity: 0.7, fontSize: '12px', maxWidth: '280px', lineHeight: 1.4 }}>
										{t('tmMobNoMyTeamsHint')}
									</div>
									<button
										type="button"
										className={s.enterBtn}
										style={{ marginTop: '8px' }}
										onClick={() => setActiveTab('discover')}
									>
										<Compass size={14} />
										<span>{t('tmMobTabDiscover')}</span>
									</button>
								</div>
							) : (
								myTeamsList.map(renderTeamCard)
							)}
						</div>
					</>
				)}

				{/* ================================================================= */}
				{/* TAB 3: PANO & ÇALIŞMA ALANI (BOARD & WORKSPACE)                   */}
				{/* ================================================================= */}
				{activeTab === 'board' && (
					<>
						{!activeBoardTeam ? (
							<div className={s.emptyCard}>
								<Columns3 size={32} opacity={0.4} />
								<div style={{ fontWeight: 700, fontSize: '15px' }}>{t('tmMobNoMyTeams')}</div>
								<div style={{ opacity: 0.7, fontSize: '12px', maxWidth: '280px', lineHeight: 1.4 }}>
									{t('tmMobNoMyTeamsHint')}
								</div>
								<button
									type="button"
									className={s.enterBtn}
									style={{ marginTop: '8px' }}
									onClick={() => setActiveTab('discover')}
								>
									<Compass size={14} />
									<span>{t('tmMobTabDiscover')}</span>
								</button>
							</div>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
								{/* Team Picker Row (if user has access to multiple teams) */}
								{(myTeamsList.length > 1 || state.teams.length > 1) && (
									<div className={s.teamPickerRow}>
										{(myTeamsList.length > 0 ? myTeamsList : state.teams).map((tm) => {
											const isSelected = activeBoardTeam.id === tm.id;
											return (
												<button
													key={tm.id}
													type="button"
													className={`${s.teamPickerBtn} ${isSelected ? s.teamPickerBtnActive : ''}`}
													onClick={() => state.showTeam(tm.id)}
												>
													<Users size={12} />
													<span>{tm.ad}</span>
												</button>
											);
										})}
									</div>
								)}

								{/* Sub-Header */}
								<div className={s.subHeader}>
									<div className={s.subTeamInfo}>
										<div className={s.subTeamTitle}>{activeBoardTeam.ad}</div>
										<div className={s.subTeamMeta}>
											<span>{activeBoardTeam.kategori}</span>
											<span>•</span>
											<span>{activeBoardTeam.liderAdSoyad || t('tmNoCaptain')}</span>
										</div>
									</div>

									{canManageTeam && (
										<button
											type="button"
											className={s.editTeamBtn}
											title={t('tmTabSettings')}
											onClick={() => state.setEditingTeam(activeBoardTeam)}
										>
											<Settings size={15} />
										</button>
									)}
								</div>

								{/* Workspace Sub-Tabs Switcher */}
								<div
									className={`${s.workspaceTabsBar} ${
										state.canSeeVault(activeBoardTeam) ? s.workspaceTabsBarFour : ''
									}`}
								>
									<button
										type="button"
										className={`${s.workspaceTabBtn} ${
											activeWorkspaceTab === 'kanban' ? s.workspaceTabBtnActive : ''
										}`}
										onClick={() => setActiveWorkspaceTab('kanban')}
									>
										<Columns3 size={13} />
										<span>{t('tmTabBoard')}</span>
									</button>
									<button
										type="button"
										className={`${s.workspaceTabBtn} ${
											activeWorkspaceTab === 'members' ? s.workspaceTabBtnActive : ''
										}`}
										onClick={() => setActiveWorkspaceTab('members')}
									>
										<Users size={13} />
										<span>{t('tmTabMembers')}</span>
										{members.length > 0 && (
											<span className={s.tabCountBadge}>{members.length}</span>
										)}
									</button>
									<button
										type="button"
										className={`${s.workspaceTabBtn} ${
											activeWorkspaceTab === 'chat' ? s.workspaceTabBtnActive : ''
										}`}
										onClick={() => setActiveWorkspaceTab('chat')}
									>
										<MessageSquare size={13} />
										<span>{t('tmTabChat')}</span>
									</button>
									{state.canSeeVault(activeBoardTeam) && (
										<button
											type="button"
											className={`${s.workspaceTabBtn} ${
												activeWorkspaceTab === 'kasa' ? s.workspaceTabBtnActive : ''
											}`}
											onClick={() => setActiveWorkspaceTab('kasa')}
										>
											<Wallet size={13} />
											<span>{t('tmTabKasa')}</span>
										</button>
									)}
								</div>

								{/* Workspace Tab Content */}
								{/* 1. KANBAN TAB */}
								{activeWorkspaceTab === 'kanban' && (
									<>
										{!state.canEnter(activeBoardTeam) ? (
											<LockedTeamView
												joinButton={
													<TeamJoinButton
														team={activeBoardTeam}
														currentUserId={state.currentUserId}
														busy={state.busy}
														myTeams={state.myTeams}
														onJoin={state.join}
														onLeave={state.leave}
													/>
												}
											/>
										) : (
											<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
												{/* Kanban Column Switcher */}
												<div className={s.kanbanColSwitcher}>
													{COLUMNS.map((col) => {
														const count = tasksByCol.get(col.id)?.length || 0;
														const isColActive = selectedKanbanCol === col.id;
														return (
															<button
																key={col.id}
																type="button"
																className={`${s.colBtn} ${isColActive ? s.colBtnActive : ''}`}
																onClick={() => setSelectedKanbanCol(col.id)}
															>
																<span>{t(col.key)}</span>
																<span className={s.colCountBadge}>{count}</span>
															</button>
														);
													})}
												</div>

												{/* Column Header & Add Task Button */}
												<div className={s.colHeaderRow}>
													<span className={s.colTitleText}>
														{t(columnMeta(selectedKanbanCol).key)} (
														{tasksByCol.get(selectedKanbanCol)?.length || 0})
													</span>
													{canManageTeam && (
														<button
															type="button"
															className={s.addTaskBtn}
															onClick={() => setNewTaskCol(selectedKanbanCol)}
														>
															<Plus size={13} />
															<span>{t('kbNewTask')}</span>
														</button>
													)}
												</div>

												{/* Column Task Cards */}
												<div className={s.taskList}>
													{(tasksByCol.get(selectedKanbanCol) || []).length === 0 ? (
														<div className={s.emptyCard}>{t('kbNoTasksInCol')}</div>
													) : (
														(tasksByCol.get(selectedKanbanCol) || []).map((task) => {
															const prio = priorityMeta(task.oncelik);
															const due = task.teslimTarihi
																? dueStatus(task.teslimTarihi, task.status, now)
																: null;
															const colIdx = COLUMNS.findIndex((c) => c.id === task.status);
															const canWork = canWorkOnTask(task);

															return (
																<div
																	key={task.id}
																	className={s.taskCard}
																	onClick={() => state.setOpenTaskId(task.id)}
																>
																	<div className={s.taskHeader}>
																		<span className={s.taskTitle}>{task.baslik}</span>
																		<span
																			className={s.prioPill}
																			style={{
																				background: `${prio.color}22`,
																				color: prio.color,
																			}}
																		>
																			{t(prio.key)}
																		</span>
																	</div>

																	{task.aciklama && (
																		<p
																			style={{
																				margin: 0,
																				fontSize: '12px',
																				opacity: 0.7,
																				lineHeight: 1.4,
																			}}
																		>
																			{task.aciklama}
																		</p>
																	)}

																	<div className={s.taskMeta}>
																		<span>{task.atananAdSoyad || t('kbUnassigned')}</span>
																		<div
																			style={{
																				display: 'flex',
																				alignItems: 'center',
																				gap: '8px',
																			}}
																		>
																			{task.teslimTarihi && due && (
																				<span
																					style={{
																						display: 'flex',
																						alignItems: 'center',
																						gap: '3px',
																					}}
																				>
																					<Clock size={11} />
																					<span>{dueText(due, task.teslimTarihi)}</span>
																				</span>
																			)}
																			{(task.maddeSayisi ?? 0) > 0 && (
																				<span
																					style={{
																						display: 'flex',
																						alignItems: 'center',
																						gap: '3px',
																					}}
																				>
																					<CheckSquare size={11} />
																					<span>
																						{task.tamamMaddeSayisi}/{task.maddeSayisi}
																					</span>
																				</span>
																			)}
																			{(task.yorumSayisi ?? 0) > 0 && (
																				<span
																					style={{
																						display: 'flex',
																						alignItems: 'center',
																						gap: '3px',
																					}}
																				>
																					<MessageSquare size={11} />
																					<span>{task.yorumSayisi}</span>
																				</span>
																			)}
																		</div>
																	</div>

																	{/* Quick move stage buttons */}
																	{canWork && (
																		<div
																			className={s.taskActionRow}
																			onClick={(e) => e.stopPropagation()}
																		>
																			{colIdx > 0 && (
																				<button
																					type="button"
																					className={s.stepBtn}
																					onClick={() => handleStepTask(task, -1)}
																				>
																					<ChevronLeft size={12} />
																					<span>{t(COLUMNS[colIdx - 1].key)}</span>
																				</button>
																			)}
																			{colIdx < COLUMNS.length - 1 && (
																				<button
																					type="button"
																					className={s.stepBtn}
																					onClick={() => handleStepTask(task, 1)}
																				>
																					<span>{t(COLUMNS[colIdx + 1].key)}</span>
																					<ChevronRight size={12} />
																				</button>
																			)}
																		</div>
																	)}
																</div>
															);
														})
													)}
												</div>
											</div>
										)}
									</>
								)}

								{/* 2. MEMBERS TAB */}
								{activeWorkspaceTab === 'members' && (
									<TeamMembers
										key={activeBoardTeam.id}
										team={activeBoardTeam}
										currentUserId={state.currentUserId}
										roster={state.roster}
										notify={notify}
										onChanged={state.fetchTeams}
									/>
								)}

								{/* 3. CHAT TAB */}
								{activeWorkspaceTab === 'chat' && (
									<TeamChatRoom
										key={activeBoardTeam.id}
										team={activeBoardTeam}
										currentUserId={state.currentUserId}
										currentUserName={
											state.currentUser
												? `${state.currentUser.ad} ${state.currentUser.soyad}`.trim()
												: t('tmMemberFallback')
										}
									/>
								)}

								{/* 4. KASA TAB */}
								{activeWorkspaceTab === 'kasa' && state.canSeeVault(activeBoardTeam) && (
									<VaultPanel
										key={activeBoardTeam.id}
										teamId={activeBoardTeam.id}
										embedded
									/>
								)}
							</div>
						)}
					</>
				)}
			</div>

			{/* ================================================================= */}
			{/* FIXED BOTTOM NAVIGATION BAR (APPLE iOS STYLE DOCK)                */}
			{/* ================================================================= */}
			<nav className={s.mobileBottomTabBar} role="tablist" aria-label={t('tmMobNavAria')}>
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

			{/* ================================================================= */}
			{/* MODALS & SHEETS                                                   */}
			{/* ================================================================= */}
			{newTaskCol && activeBoardTeam && (
				<NewTaskModal
					teamId={activeBoardTeam.id}
					column={newTaskCol}
					members={members}
					labels={allLabels}
					onClose={() => setNewTaskCol(null)}
					onCreated={async () => {
						setNewTaskCol(null);
						notify(t('kbCreated'));
						await state.fetchTeams();
					}}
				/>
			)}

			{state.openTaskId && (
				<TaskDetailModal
					taskId={state.openTaskId}
					currentUserId={state.currentUserId}
					members={members}
					allLabels={allLabels}
					notify={notify}
					onClose={() => state.setOpenTaskId(null)}
					onChanged={state.fetchTeams}
				/>
			)}

			{state.editingTeam && (
				<EditTeamModal
					team={state.editingTeam}
					roster={state.roster}
					categories={state.teamCategories}
					onClose={() => state.setEditingTeam(null)}
					onSaved={async () => {
						state.setEditingTeam(null);
						notify(t('tmUpdated'));
						await state.fetchTeams();
					}}
				/>
			)}

			{state.creating && (
				<NewTeamModal
					roster={state.roster}
					categories={state.teamCategories}
					onClose={() => state.setCreating(false)}
					onCreated={async () => {
						state.setCreating(false);
						state.playSystemSound();
						state.notify(t('tmCreated'));
						await state.fetchTeams();
					}}
				/>
			)}

			{state.applyTo && (
				<ApplyModal
					teamName={state.applyTo.ad}
					onClose={() => state.setApplyTo(null)}
					onSend={async (note) => {
						if (await state.post({ action: 'join', teamId: state.applyTo!.id, basvuruNotu: note })) {
							state.setApplyTo(null);
						}
					}}
				/>
			)}
		</div>
	);
}
