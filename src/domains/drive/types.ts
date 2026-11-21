export type DriveViewMode = 'my' | 'shared' | 'starred' | 'recent' | 'trash';
export type DriveSharePermission = 'view' | 'edit';
export type StorageQuotaScope = 'global' | 'role' | 'user';

export interface DriveFolderRecord {
	id: string;
	ownerId: string;
	parentId: string | null;
	name: string;
	isTrashed: boolean;
	trashedAt: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface DriveItemRecord {
	id: string;
	ownerId: string;
	ownerName?: string;
	folderId: string | null;
	fileId: string;
	displayName: string;
	mimeType: string;
	sizeBytes: number;
	isStarred: boolean;
	isTrashed: boolean;
	trashedAt: number | null;
	createdAt: number;
	updatedAt: number;
	sharedPermission?: DriveSharePermission;
}

export interface DriveShareRecord {
	id: string;
	itemId: string | null;
	folderId: string | null;
	ownerId: string;
	targetUserId: string | null;
	targetUserName?: string | null;
	targetRoleId: string | null;
	targetRoleName?: string | null;
	permission: DriveSharePermission;
	createdAt: number;
}

export interface StorageQuotaRecord {
	id: string;
	scopeType: StorageQuotaScope;
	scopeId: string;
	quotaBytes: number;
	updatedBy: string | null;
	updatedAt: number;
}

export interface MemberStorageOverviewRow {
	userId: string;
	name: string;
	email: string;
	roleId: string;
	roleName: string;
	usedBytes: number;
	effectiveQuotaBytes: number;
	customQuotaBytes: number | null;
	byApp: {
		drive: number;
		notes: number;
		chat: number;
		other: number;
	};
}
