export interface SearchMatchRange {
	start: number;
	end: number;
}

export interface ChatSearchHit {
	id: string;
	roomId: string;
	roomName: string;
	roomType: 'general' | 'team' | 'private';
	senderId: string;
	senderName: string;
	senderPhoto: string | null;
	content: string;
	snippet: string;
	matches: SearchMatchRange[];
	hasAttachment: boolean;
	date: number;
}

export interface ChatSearchParams {
	userId: string;
	isAdmin: boolean;
	q: string;
	roomId?: string;
	senderId?: string;
	hasAttachment?: boolean;
	from?: number;
	to?: number;
	limit?: number;
	offset?: number;
}

export interface ChatSearchResult {
	hits: ChatSearchHit[];
	hasMore: boolean;
	nextOffset: number;
}
