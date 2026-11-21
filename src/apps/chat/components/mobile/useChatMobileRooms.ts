'use client';

import { useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import type { ChatRoomItem } from '../../types';

export function useChatMobileRooms(rooms: ChatRoomItem[], searchQuery: string) {
	const { language } = useI18n();

	const filteredRooms = useMemo(() => {
		const q = searchQuery.trim().toLocaleLowerCase(language);
		if (!q) return rooms;
		return rooms.filter((r) => r.name.toLocaleLowerCase(language).includes(q));
	}, [rooms, searchQuery, language]);

	const generalRooms = useMemo(
		() => filteredRooms.filter((r) => r.typeValue !== 'team' && r.typeValue !== 'private'),
		[filteredRooms]
	);

	const teamRooms = useMemo(
		() => filteredRooms.filter((r) => r.typeValue === 'team'),
		[filteredRooms]
	);

	const customRooms = useMemo(
		() => filteredRooms.filter((r) => r.typeValue === 'private'),
		[filteredRooms]
	);

	const totalUnreadCount = useMemo(
		() => rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0),
		[rooms]
	);
	const unreadDirectCount = useMemo(
		() => customRooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0),
		[customRooms]
	);
	const unreadChannelsCount = useMemo(
		() => generalRooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0),
		[generalRooms]
	);
	const unreadTeamsCount = useMemo(
		() => teamRooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0),
		[teamRooms]
	);

	return {
		filteredRooms,
		generalRooms,
		teamRooms,
		customRooms,
		totalUnreadCount,
		unreadDirectCount,
		unreadChannelsCount,
		unreadTeamsCount,
	};
}
