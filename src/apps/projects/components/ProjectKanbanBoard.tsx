'use client';

import React from 'react';
import { Clock, PlayCircle, CheckCircle2, Pin, FolderGit2, Star } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Project } from '@/db/schema';

interface ProjectKanbanBoardProps {
	projects: Project[];
	locale?: string;
	onOpen: (id: string) => void;
	onOpenTeam?: (teamId: string) => void;
	onStar: (project: Project) => void;
	onMoveStatus?: (project: Project, newStatus: Project['status']) => void;
}

export function ProjectKanbanBoard({
	projects,
	locale: _locale,
	onOpen,
	onOpenTeam: _onOpenTeam,
	onStar,
	onMoveStatus: _onMoveStatus,
}: ProjectKanbanBoardProps) {
	const { t } = useI18n();

	const columns: {
		id: Project['status'];
		title: string;
		icon: React.ReactNode;
		color: string;
		items: Project[];
	}[] = [
		{
			id: 'oneri',
			title: t('pjKanbanTodo'),
			icon: <Clock size={15} color="#ff9f0a" />,
			color: '#ff9f0a',
			items: projects.filter((p) => p.status === 'oneri'),
		},
		{
			id: 'yayinda',
			title: t('pjKanbanInProgress'),
			icon: <PlayCircle size={15} color="#0a84ff" />,
			color: '#0a84ff',
			items: projects.filter((p) => p.status === 'yayinda' && Number(p.oneCikan) !== 1),
		},
		{
			id: 'arsiv',
			title: t('pjKanbanDone'),
			icon: <CheckCircle2 size={15} color="#30d158" />,
			color: '#30d158',
			items: projects.filter((p) => p.status === 'arsiv' || Number(p.oneCikan) === 1),
		},
	];

	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
				gap: '16px',
				alignItems: 'start',
				minHeight: '400px',
			}}
		>
			{columns.map((col) => (
				<div
					key={col.id}
					style={{
						background: 'rgba(255, 255, 255, 0.03)',
						border: '1px solid var(--card-border)',
						borderRadius: '14px',
						display: 'flex',
						flexDirection: 'column',
						maxHeight: 'calc(100vh - 220px)',
						overflow: 'hidden',
					}}
				>
					<div
						style={{
							padding: '12px 14px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							borderBottom: '1px solid var(--card-border)',
							background: 'rgba(0, 0, 0, 0.1)',
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							{col.icon}
							<span style={{ fontSize: '13px', fontWeight: 700 }}>{col.title}</span>
						</div>
						<span
							style={{
								fontSize: '11px',
								fontWeight: 700,
								padding: '2px 7px',
								borderRadius: '10px',
								background: `${col.color}20`,
								color: col.color,
							}}
						>
							{col.items.length}
						</span>
					</div>

					<div
						style={{
							padding: '12px',
							display: 'flex',
							flexDirection: 'column',
							gap: '10px',
							overflowY: 'auto',
							flex: 1,
						}}
					>
						{col.items.length === 0 ? (
							<div
								style={{
									padding: '28px 14px',
									textAlign: 'center',
									fontSize: '12px',
									color: 'var(--text-secondary)',
									fontStyle: 'italic',
								}}
							>
								{t('pjEmpty')}
							</div>
						) : (
							col.items.map((p) => {
								const featured = Number(p.oneCikan) === 1;
								return (
									<div
										key={p.id}
										tabIndex={0}
										role="button"
										onClick={() => onOpen(p.id)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												onOpen(p.id);
											}
										}}
										style={{
											background: 'var(--card-bg)',
											border: featured ? '1px solid color-mix(in srgb, #ff9f0a 50%, var(--card-border))' : '1px solid var(--card-border)',
											borderRadius: '10px',
											padding: '12px',
											cursor: 'pointer',
											display: 'flex',
											flexDirection: 'column',
											gap: '8px',
											boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
											transition: 'transform 120ms ease, box-shadow 120ms ease',
										}}
									>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
											<h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, lineHeight: 1.3 }}>{p.baslik}</h4>
											{featured && (
												<span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255, 159, 10, 0.2)', color: '#ff9f0a', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
													<Pin size={10} />
												</span>
											)}
										</div>

										<p
											style={{
												margin: 0,
												fontSize: '12px',
												color: 'var(--text-secondary)',
												lineHeight: 1.4,
												display: '-webkit-box',
												WebkitLineClamp: 2,
												WebkitBoxOrient: 'vertical',
												overflow: 'hidden',
											}}
										>
											{p.ozet}
										</p>

										{p.teknolojiler.length > 0 && (
											<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
												{p.teknolojiler.slice(0, 3).map((tech) => (
													<span
														key={tech}
														style={{
															fontSize: '10px',
															padding: '2px 6px',
															borderRadius: '6px',
															background: 'rgba(255, 255, 255, 0.06)',
															color: 'var(--text-secondary)',
														}}
													>
														{tech}
													</span>
												))}
												{p.teknolojiler.length > 3 && (
													<span style={{ fontSize: '10px', opacity: 0.6 }}>+{p.teknolojiler.length - 3}</span>
												)}
											</div>
										)}

										<div
											style={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												marginTop: '4px',
												paddingTop: '6px',
												borderTop: '1px solid rgba(255, 255, 255, 0.05)',
												fontSize: '11px',
											}}
											onClick={(e) => e.stopPropagation()}
										>
											<span style={{ opacity: 0.7 }}>{p.olusturanAdSoyad || '—'}</span>

											<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
												{p.repoUrl && (
													<a
														href={p.repoUrl}
														target="_blank"
														rel="noreferrer noopener"
														style={{ color: 'inherit', opacity: 0.7 }}
														title={p.repoUrl}
													>
														<FolderGit2 size={13} />
													</a>
												)}
												<button
													type="button"
													onClick={() => onStar(p)}
													style={{
														background: 'transparent',
														border: 'none',
														cursor: 'pointer',
														display: 'flex',
														alignItems: 'center',
														gap: '3px',
														fontSize: '11px',
														color: p.begendimMi ? '#ff9f0a' : 'inherit',
														opacity: p.begendimMi ? 1 : 0.7,
													}}
												>
													<Star size={12} fill={p.begendimMi ? 'currentColor' : 'none'} />
													{p.begeniSayisi ?? 0}
												</button>
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			))}
		</div>
	);
}
