'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { MessageSquare, RefreshCw, MessageSquarePlus, Search } from 'lucide-react';
import type { ChatRoomItem } from '../types';
import { ChatRoomList } from './ChatRoomList';
import { ChatSearchDrawer } from './ChatSearchDrawer';
import s from '../ChatSidebar.module.css';

interface ChatSidebarProps {
	rooms: ChatRoomItem[];
	activeRoomId: string | null;
	hiddenOnMobile: boolean;
	onSelectRoom: (roomId: string) => void;
	onOpenNewChat: () => void;
	onRefreshRooms: () => void;
	onJumpToHit?: (roomId: string, messageId: string) => void;
}

export function ChatSidebar({
	rooms,
	activeRoomId,
	hiddenOnMobile,
	onSelectRoom,
	onOpenNewChat,
	onRefreshRooms,
	onJumpToHit,
}: ChatSidebarProps) {
	const { t } = useI18n();
	const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

	return (
		<div className={s.sidebar} style={{ display: hiddenOnMobile ? 'none' : 'flex' }}>
			<div className={s.sidebarHeader}>
				<div className={s.sidebarTitle}>
					<MessageSquare size={18} color="var(--accent)" />
					<span>{t('chatTitle')}</span>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
					<button
						type="button"
						onClick={() => setIsGlobalSearchOpen((v) => !v)}
						style={{
							background: isGlobalSearchOpen ? 'var(--accent-subtle)' : 'transparent',
							border: 'none',
							color: isGlobalSearchOpen ? 'var(--accent)' : 'var(--text-secondary)',
							cursor: 'pointer',
							padding: '5px',
						}}
						title={t('chatSearchMessagesPh')}
					>
						<Search size={14} />
					</button>
					<button
						type="button"
						onClick={onOpenNewChat}
						style={{
							background: 'var(--accent-subtle)',
							border: '1px solid var(--accent-border)',
							color: 'var(--accent)',
							cursor: 'pointer',
							padding: '5px 7px',
							borderRadius: '8px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
						title={t('chatNewChat')}
					>
						<MessageSquarePlus size={15} />
					</button>

					<button
						type="button"
						onClick={onRefreshRooms}
						style={{
							background: 'transparent',
							border: 'none',
							color: 'rgba(255, 255, 255, 0.6)',
							cursor: 'pointer',
							padding: '5px',
						}}
						title={t('chatRefresh')}
					>
						<RefreshCw size={14} />
					</button>
				</div>
			</div>

			<ChatSearchDrawer
				isOpen={isGlobalSearchOpen}
				onClose={() => setIsGlobalSearchOpen(false)}
				onJumpToHit={(roomId, messageId) => {
					if (onJumpToHit) onJumpToHit(roomId, messageId);
					else onSelectRoom(roomId);
				}}
			/>

			<ChatRoomList
				rooms={rooms}
				activeRoomId={activeRoomId}
				onSelectRoom={onSelectRoom}
			/>
		</div>
	);
}
