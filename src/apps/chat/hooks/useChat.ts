'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useWindowFocusTarget } from '@/core/windows';
import { useAppCommand } from '@/core/commands';
import {
	getNotificationPermission,
	requestNotificationPermission,
} from '@/lib/client/notifications';
import type { ChatRoomItem, ChatMessageItem } from '../types';
import { useChatMessages } from './useChatMessages';
import { useChatRooms } from './useChatRooms';
import { useChatStream } from './useChatStream';
import { useChatMessageActions } from './useChatMessageActions';
import { useChatPolls } from './useChatPolls';

export function useChat(initialRoomId?: string | null) {
	const { currentUser, isAdmin } = useSession();
	const { playSystemSound } = useSound();
	const { focusTarget, clearFocusTarget } = useWindowFocusTarget('chat');
	const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
	const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRoomId || null);
	const [messages, setMessages] = useState<ChatMessageItem[]>([]);
	const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);

	const activeRoomRef = useRef<string | null>(activeRoomId);
	const currentUserIdRef = useRef<string | null>(currentUser?.id ?? null);
	const isAdminRef = useRef<boolean>(Boolean(isAdmin));
	const playSystemSoundRef = useRef(playSystemSound);
	const focusTargetRef = useRef(focusTarget);

	useEffect(() => {
		if (initialRoomId) setActiveRoomId(initialRoomId);
	}, [initialRoomId]);

	useEffect(() => {
		focusTargetRef.current = focusTarget;
	}, [focusTarget]);

	useEffect(() => {
		activeRoomRef.current = activeRoomId;
	}, [activeRoomId]);

	useEffect(() => {
		currentUserIdRef.current = currentUser?.id ?? null;
		isAdminRef.current = Boolean(isAdmin);
	}, [currentUser?.id, isAdmin]);

	useEffect(() => {
		playSystemSoundRef.current = playSystemSound;
	}, [playSystemSound]);

	useEffect(() => {
		if (getNotificationPermission() === 'default') {
			void requestNotificationPermission().catch(() => {});
		}
	}, []);

	const {
		loadingMessages,
		loadingOlderMessages,
		hasMoreMessages,
		fetchMessages,
		loadOlderMessages,
		jumpToMessage,
	} = useChatMessages({
		activeRoomId,
		activeRoomRef,
		messages,
		setMessages,
		setRooms,
	});

	const {
		loadingRooms,
		fetchRooms,
		fetchRoomsRef,
		createDm,
		createGroupDm,
		addMembers,
	} = useChatRooms({
		rooms,
		setRooms,
		activeRoomRef,
		focusTargetRef,
		setActiveRoomId,
		fetchMessages,
	});

	useAppCommand('chat', (cmd) => {
		if (cmd === 'chat-refresh') {
			void fetchRooms();
			if (activeRoomRef.current) void fetchMessages(activeRoomRef.current);
		}
	});

	useChatStream({
		activeRoomRef,
		currentUserIdRef,
		isAdminRef,
		playSystemSoundRef,
		fetchRoomsRef,
		setMessages,
		setRooms,
	});

	const {
		sending,
		replyingMessage,
		setReplyingMessage,
		cancelReply,
		sendMessage,
		forwardMessage,
		deleteMessage,
		editMessage,
	} = useChatMessageActions({
		activeRoomId,
		activeRoomRef,
		fetchMessages,
		fetchRooms,
		setMessages,
	});

	const { votePoll, closePoll, createPoll } = useChatPolls({
		activeRoomId,
		setMessages,
	});

	const selectRoom = useCallback((roomId: string) => {
		setFocusedMessageId(null);
		setActiveRoomId(roomId);
	}, []);

	useEffect(() => {
		if (focusTarget && focusTarget.appId === 'chat') {
			const { section, itemId, kind, parentId } = focusTarget;
			if (kind === 'thread' && itemId) {
				setActiveRoomId(itemId);
				setFocusedMessageId(parentId || null);
			} else if (section === 'compose' || kind === 'dm') {
				if (itemId) {
					const existingDm = rooms.find(
						(r) => r.typeValue === 'private' && r.peerUserId === itemId
					);
					if (existingDm) {
						setActiveRoomId(existingDm.id);
					} else {
						void createDm(itemId);
					}
				}
			} else if (itemId) {
				setActiveRoomId(itemId);
			}
			clearFocusTarget(focusTarget.nonce);
		}
	}, [focusTarget, clearFocusTarget, rooms, createDm]);

	const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
	const refreshMessages = useCallback(() => {
		if (activeRoomRef.current) void fetchMessages(activeRoomRef.current);
	}, [fetchMessages]);
	const focusMessageInRoom = useCallback(
		(roomId: string, messageId: string) => {
			setActiveRoomId(roomId);
			setFocusedMessageId(messageId);
			void jumpToMessage(roomId, messageId);
		},
		[jumpToMessage]
	);
	const clearFocusedMessage = useCallback(() => {
		setFocusedMessageId(null);
	}, []);

	return {
		rooms,
		activeRoom,
		activeRoomId,
		messages,
		loadingRooms,
		loadingMessages,
		loadingOlderMessages,
		hasMoreMessages,
		loadOlderMessages,
		sending,
		sendMessage,
		deleteMessage,
		editMessage,
		selectRoom,
		focusMessageInRoom,
		refreshRooms: fetchRooms,
		refreshMessages,
		createDm,
		createGroupDm,
		addMembers,
		createPoll,
		votePoll,
		closePoll,
		replyingMessage,
		focusedMessageId,
		clearFocusedMessage,
		setReplyingMessage,
		cancelReply,
		forwardMessage,
	};
}
