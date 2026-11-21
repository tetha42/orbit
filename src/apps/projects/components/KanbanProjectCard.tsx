'use client';

import React from 'react';
import { FolderGit2, Pin, Star } from 'lucide-react';
import type { Project } from '@/db/schema';

interface KanbanProjectCardProps {
	project: Project;
	onOpen: (id: string) => void;
	onStar: (project: Project) => void;
}

export function KanbanProjectCard({ project: p, onOpen, onStar }: KanbanProjectCardProps) {
	const featured = Number(p.isFeatured) === 1;

	return (
		<div
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
				border: featured ? '1px solid color-mix(in srgb, var(--warning) 50%, var(--card-border))' : '1px solid var(--card-border)',
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
				<h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, lineHeight: 1.3 }}>{p.title}</h4>
				{featured && (
					<span
						style={{
							fontSize: '10px',
							padding: '1px 5px',
							borderRadius: '4px',
							background: 'color-mix(in srgb, var(--warning) 20%, transparent)',
							color: 'var(--warning)',
							fontWeight: 800,
							display: 'inline-flex',
							alignItems: 'center',
							gap: '3px',
						}}
					>
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
				{p.summary}
			</p>

			{p.technologies.length > 0 && (
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
					{p.technologies.slice(0, 3).map((tech) => (
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
					{p.technologies.length > 3 && <span style={{ fontSize: '10px', opacity: 0.6 }}>+{p.technologies.length - 3}</span>}
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
				<span style={{ opacity: 0.7 }}>{p.creatorName || '—'}</span>

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
							color: p.likedByMe ? 'var(--warning)' : 'inherit',
							opacity: p.likedByMe ? 1 : 0.7,
						}}
					>
						<Star size={12} fill={p.likedByMe ? 'currentColor' : 'none'} />
						{p.likeCount ?? 0}
					</button>
				</div>
			</div>
		</div>
	);
}
