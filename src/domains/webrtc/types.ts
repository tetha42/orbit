export interface CallParticipant {
	userId: string;
	name: string;
	joinedAt: number;
	muted: boolean;
}

export type ChatCallStatus = 'ringing' | 'active' | 'ended' | 'missed';

export interface ChatCallRecord {
	id: string;
	roomId: string;
	initiatorId: string;
	status: ChatCallStatus;
	participants: CallParticipant[];
	startedAt: number;
	answeredAt: number | null;
	endedAt: number | null;
}

export type CallSignalKind = 'offer' | 'answer' | 'ice';

export interface CallSignalRecord {
	id: string;
	callId: string;
	fromUserId: string;
	toUserId: string;
	kind: CallSignalKind;
	payload: unknown;
	createdAt: number;
}
