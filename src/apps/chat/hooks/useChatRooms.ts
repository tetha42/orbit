'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatRoomItem } from '../types';

interface UseChatRoomsParams {
	rooms: ChatRoomItem[];
	setRooms: React.Dispatch<React.SetStateAction<ChatRoomItem[]>>;
	activeRoomRef: React.RefObject<string | null>;
	focusTargetRef: React.RefObject<unknown>;
	setActiveRoomId: React.Dispatch<React.SetStateAction<string | null>>;
	fetchMessages: (roomId: string) => Promise<void>;
}

export function useChatRooms({
	rooms,
	setRooms,
	activeRoomRef,
	focusTargetRef,
	setActiveRoomId,
	fetchMessages,
}: UseChatRoomsParams) {
	const [loadingRooms, setLoadingRooms] = useState(true);

	const fetchRooms = useCallback(async () => {
		try {
			const res = await fetch('/api/chat/rooms', { cache: 'no-store' });
			const data = await res.json();
			if (data.ok && Array.isArray(data.rooms)) {
				setRooms(data.rooms);
				if (!activeRoomRef.current && !focusTargetRef.current && data.rooms.length > 0) {
					setActiveRoomId(data.rooms[0].id);
				}
			}
		} catch {
			// Handled gracefully in UI
		} finally {
			setLoadingRooms(false);
		}
	}, [setRooms, activeRoomRef, focusTargetRef, setActiveRoomId]);

	const fetchRoomsRef = useRef(fetchRooms);
	useEffect(() => {
		fetchRoomsRef.current = fetchRooms;
	}, [fetchRooms]);

	useEffect(() => {
		void fetchRooms();
	}, [fetchRooms]);

	const createDm = useCallback(
		async (targetUserId: string): Promise<string | null> => {
			const known = rooms.find(
				(room) => room.typeValue === 'private' && room.peerUserId === targetUserId
			);
			if (known) {
				setActiveRoomId(known.id);
				return known.id;
			}
			try {
				const res = await fetch('/api/chat/rooms', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'create_dm', targetUserId }),
				});
				const data = await res.json();
				if (data.ok && data.roomId) {
					await fetchRooms();
					setActiveRoomId(data.roomId);
					return data.roomId;
				}
				return null;
			} catch {
				return null;
			}
		},
		[fetchRooms, rooms, setActiveRoomId]
	);

	const createGroupDm = useCallback(
		async (memberIds: string[], title?: string): Promise<string | null> => {
			try {
				const res = await fetch('/api/chat/rooms', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'create_group_dm', memberIds, title }),
				});
				const data = await res.json();
				if (data.ok && data.roomId) {
					await fetchRooms();
					setActiveRoomId(data.roomId);
					return data.roomId;
				}
				return null;
			} catch {
				return null;
			}
		},
		[fetchRooms, setActiveRoomId]
	);

	const addMembers = useCallback(
		async (roomId: string, memberIds: string[]): Promise<boolean> => {
			try {
				const res = await fetch('/api/chat/rooms', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'add_members', roomId, memberIds }),
				});
				const data = await res.json();
				if (data.ok) {
					await fetchRooms();
					await fetchMessages(roomId);
					return true;
				}
				return false;
			} catch {
				return false;
			}
		},
		[fetchRooms, fetchMessages]
	);

	return {
		loadingRooms,
		fetchRooms,
		fetchRoomsRef,
		createDm,
		createGroupDm,
		addMembers,
	};
}
