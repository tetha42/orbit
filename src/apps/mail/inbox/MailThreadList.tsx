'use client';

import React from 'react';
import { PenLine, Users } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import ui from '@/core/ui/ui.module.css';
import type { MailThreadSummary } from '@/lib/messages';

interface MailThreadListProps {
	topics: MailThreadSummary[];
	loading: boolean;
	selectedId: string | null;
	onSelect: (id: string) => void;
	onCompose: () => void;
	formatTime: (value: number) => string;
}

const people = (thread: MailThreadSummary) =>
	thread.attendees.length > 0
		? thread.attendees.map((a) => `${a.name} ${a.surname}`).join(', ')
		: '—';

/** The middle column: one row per conversation, newest first. */
export function MailThreadList({ topics, loading, selectedId, onSelect, onCompose, formatTime }: MailThreadListProps) {
	const { t } = useI18n();

	return (
		<div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--window-border)' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 9px' }}>
				<div style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>{t('mailListLabel')}</div>
				<button type="button" className={ui.primaryBtn} data-mail-compose onClick={onCompose} style={{ fontSize: 11.5, padding: '5px 10px' }}>
					<PenLine size={13} /> {t('mailCompose')}
				</button>
			</div>

			<div style={{ overflowY: 'auto', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }} aria-label={t('mailListAria')}>
				{loading ? (
					<div className={ui.muted} style={{ fontSize: 12, padding: '12px 10px' }}>
						{t('mailLoading')}
					</div>
				) : topics.length === 0 ? (
					<div data-mail-empty className={ui.muted} style={{ fontSize: 12, padding: '16px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
						<Users size={14} /> {t('mailEmptyFolder')}
					</div>
				) : (
					topics.map((thread) => {
						const unread = Number(thread.unread) > 0;
						const selected = thread.id === selectedId;
						return (
							<button
								key={thread.id}
								type="button"
								data-mail-thread={thread.id}
								data-focus-id={`thread:${thread.id}`}
								data-unread={unread ? '' : undefined}
								onClick={() => onSelect(thread.id)}
								style={{
									textAlign: 'left',
									border: 'none',
									borderRadius: 8,
									padding: '8px 10px',
									cursor: 'pointer',
									color: 'inherit',
									background: selected ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
									display: 'flex',
									flexDirection: 'column',
									gap: 3,
								}}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
									{unread && <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--accent)', flexShrink: 0 }} />}
									<strong style={{ fontSize: 12.5, fontWeight: unread ? 800 : 650, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{people(thread)}
									</strong>
									<span style={{ fontSize: 10, opacity: 0.55, flexShrink: 0 }}>{formatTime(thread.lastMessage)}</span>
								</div>
								<div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.topic}</div>
								<div style={{ fontSize: 11, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.preview}</div>
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}
