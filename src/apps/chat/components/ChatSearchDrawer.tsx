'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Paperclip, Search, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatSearchHit } from '@/domains/chatSearch/types';
import { fill } from '@/lib/text';

interface ChatSearchDrawerProps {
	roomId?: string | null;
	isOpen: boolean;
	onClose: () => void;
	onJumpToHit: (roomId: string, messageId: string) => void;
}

function renderHighlightedSnippet(snippet: string, matches: Array<{ start: number; end: number }>) {
	if (!matches || matches.length === 0) return snippet;
	const parts: React.ReactNode[] = [];
	let cursor = 0;
	for (let i = 0; i < matches.length; i++) {
		const m = matches[i];
		if (m.start > cursor) {
			parts.push(snippet.slice(cursor, m.start));
		}
		parts.push(
			<mark
				key={`${m.start}-${m.end}-${i}`}
				style={{
					background: 'var(--accent-subtle)',
					color: 'var(--accent)',
					borderRadius: '3px',
					padding: '0 2px',
				}}
			>
				{snippet.slice(m.start, m.end)}
			</mark>
		);
		cursor = m.end;
	}
	if (cursor < snippet.length) {
		parts.push(snippet.slice(cursor));
	}
	return parts;
}

export function ChatSearchDrawer({ roomId, isOpen, onClose, onJumpToHit }: ChatSearchDrawerProps) {
	const { t } = useI18n();
	const [query, setQuery] = useState('');
	const [hasAttachment, setHasAttachment] = useState(false);
	const [hits, setHits] = useState<ChatSearchHit[]>([]);
	const [activeIdx, setActiveIdx] = useState(0);
	const [loading, setLoading] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setTimeout(() => inputRef.current?.focus(), 20);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const q = query.trim();
		if (q.length < 2) {
			setHits([]);
			setActiveIdx(0);
			return;
		}
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			setLoading(true);
			try {
				const params = new URLSearchParams({ q, limit: '30' });
				if (roomId) params.set('roomId', roomId);
				if (hasAttachment) params.set('hasAttachment', '1');
				const res = await fetch(`/api/chat/search?${params.toString()}`, {
					cache: 'no-store',
					signal: ctrl.signal,
				});
				if (!res.ok) return;
				const data = (await res.json()) as { hits?: ChatSearchHit[] };
				const nextHits = Array.isArray(data.hits) ? data.hits : [];
				setHits(nextHits);
				setActiveIdx(0);
			} catch {
				// Ignore aborted search request
			} finally {
				setLoading(false);
			}
		}, 180);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [isOpen, query, roomId, hasAttachment]);

	if (!isOpen) return null;

	const selectIdx = (idx: number) => {
		if (hits.length === 0) return;
		const bounded = (idx + hits.length) % hits.length;
		setActiveIdx(bounded);
		const hit = hits[bounded];
		if (hit) onJumpToHit(hit.roomId, hit.id);
	};

	return (
		<div
			style={{
				borderBottom: '1px solid var(--border-subtle)',
				background: 'var(--window-bg)',
				padding: '8px 12px',
				display: 'flex',
				flexDirection: 'column',
				gap: '8px',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
				<Search size={14} color="var(--text-secondary)" />
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={roomId ? t('chatSearchInRoom') : t('chatSearchMessagesPh')}
					style={{
						flex: 1,
						background: 'var(--surface-hover)',
						border: '1px solid var(--border-subtle)',
						borderRadius: '8px',
						padding: '5px 10px',
						fontSize: '12px',
						color: 'var(--text-primary)',
						outline: 'none',
					}}
				/>
				<button
					type="button"
					onClick={() => setHasAttachment((v) => !v)}
					title={t('chatSearchHasAttachment')}
					style={{
						background: hasAttachment ? 'var(--accent-subtle)' : 'transparent',
						border: '1px solid var(--border-subtle)',
						borderRadius: '6px',
						padding: '4px 6px',
						color: hasAttachment ? 'var(--accent)' : 'var(--text-secondary)',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
					}}
				>
					<Paperclip size={13} />
				</button>
				{hits.length > 0 && (
					<>
						<span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
							{fill(t('chatSearchHitCounter'), { current: activeIdx + 1, total: hits.length })}
						</span>
						<button
							type="button"
							onClick={() => selectIdx(activeIdx - 1)}
							title={t('chatSearchPrevHit')}
							style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
						>
							<ChevronUp size={14} />
						</button>
						<button
							type="button"
							onClick={() => selectIdx(activeIdx + 1)}
							title={t('chatSearchNextHit')}
							style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
						>
							<ChevronDown size={14} />
						</button>
					</>
				)}
				<button
					type="button"
					onClick={onClose}
					title={t('chatSearchClose')}
					style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
				>
					<X size={15} />
				</button>
			</div>

			{query.trim().length >= 2 && (
				<div
					style={{
						maxHeight: '180px',
						overflowY: 'auto',
						display: 'flex',
						flexDirection: 'column',
						gap: '4px',
					}}
				>
					{loading ? (
						<div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px' }}>
							{t('chatSearchLoading')}
						</div>
					) : hits.length === 0 ? (
						<div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px' }}>
							{t('chatSearchNoHits')}
						</div>
					) : (
						hits.map((hit, i) => (
							<button
								key={hit.id}
								type="button"
								onClick={() => {
									setActiveIdx(i);
									onJumpToHit(hit.roomId, hit.id);
								}}
								style={{
									textAlign: 'left',
									background: i === activeIdx ? 'var(--accent-subtle)' : 'var(--surface-hover)',
									border: '1px solid var(--border-subtle)',
									borderRadius: '8px',
									padding: '6px 10px',
									cursor: 'pointer',
									color: 'var(--text-primary)',
								}}
							>
								<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
									<span>{roomId ? hit.senderName : `${hit.roomName} · ${hit.senderName}`}</span>
									<span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
										{new Date(hit.date).toLocaleDateString()}
									</span>
								</div>
								<div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
									{renderHighlightedSnippet(hit.snippet, hit.matches)}
								</div>
							</button>
						))
					)}
				</div>
			)}
		</div>
	);
}
