import type { AppID, FocusTargetInput } from './workspace';

/** What kind of record a search hit points at; the client maps each to a label and icon. */
export type SearchKind =
	| 'member'
	| 'team'
	| 'task'
	| 'event'
	| 'news'
	| 'item'
	| 'certificate'
	| 'ledger'
	| 'message';

/** One result from `GET /api/search`. */
export interface SearchHit {
	/** Stable across requests: `"<kind>:<record id>"`. */
	id: string;
	kind: SearchKind;
	/** The app that opens this record. */
	appId: AppID;
	title: string;
	subtitle?: string;
	/** Where the app should land — passed straight to `openApp(appId, target)`. */
	target: FocusTargetInput;
	score: number;
}

export interface SearchResponse {
	q: string;
	/** True when some kind had more matches than were returned. */
	truncated: boolean;
	hits: SearchHit[];
}

/** The most hits returned for any one kind, so no single record type drowns out the rest. */
export const MAX_HITS_PER_KIND = 5;
