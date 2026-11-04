export interface MemberTeamInfo {
	id: string;
	name: string;
	category?: string;
	leaderMi?: boolean;
	role?: string;
}

export interface MemberRecord {
	id: string;
	firstName: string;
	lastName: string;
	name: string;
	surname: string;
	email: string;
	handle: string;
	studentNo?: string;
	department: string;
	grade: number;
	roleId?: string | null;
	roleName?: string | null;
	roleColor?: string | null;
	avatarUrl?: string;
	profilePhoto?: string;
	bio?: string;
	xp: number;
	status: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun';
	createdAt: number;
	creation: number;
	teamName?: string;
	teams?: MemberTeamInfo[];
	attendanceCount?: number;
	diskUsageBytes?: number;
	fileCount?: number;
	customFields?: Record<string, string>;
}

export interface AssignableRole {
	id: string;
	name: string;
	color: string;
	assignable: boolean;
}
