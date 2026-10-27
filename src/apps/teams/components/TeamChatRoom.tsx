'use client';

import React from 'react';
import type { Team } from '../types';
import { TeamChatEmbed } from '@/apps/chat/components/TeamChatEmbed';

interface TeamChatRoomProps {
	team: Team;
	currentUserId: string;
	currentUserName: string;
}

export function TeamChatRoom({ team }: TeamChatRoomProps) {
	return <TeamChatEmbed teamId={team.id} takimAd={team.ad} />;
}
