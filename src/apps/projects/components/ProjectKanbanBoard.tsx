'use client';

import React from 'react';
import { Clock, PlayCircle, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Project } from '@/db/schema';
import { KanbanProjectCard } from './KanbanProjectCard';

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
			id: 'proposed',
			title: t('pjKanbanTodo'),
			icon: <Clock size={15} color="var(--warning)" />,
			color: 'var(--warning)',
			items: projects.filter((p) => p.status === 'proposed'),
		},
		{
			id: 'published',
			title: t('pjKanbanInProgress'),
			icon: <PlayCircle size={15} color="var(--accent)" />,
			color: 'var(--accent)',
			items: projects.filter((p) => p.status === 'published' && Number(p.isFeatured) !== 1),
		},
		{
			id: 'archived',
			title: t('pjKanbanDone'),
			icon: <CheckCircle2 size={15} color="var(--success)" />,
			color: 'var(--success)',
			items: projects.filter((p) => p.status === 'archived' || Number(p.isFeatured) === 1),
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
								background: `color-mix(in srgb, ${col.color} 13%, transparent)`,
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
							col.items.map((p) => (
								<KanbanProjectCard key={p.id} project={p} onOpen={onOpen} onStar={onStar} />
							))
						)}
					</div>
				</div>
			))}
		</div>
	);
}
