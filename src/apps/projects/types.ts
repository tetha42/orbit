import type { Project } from '@/db/schema';

export interface ProjectsResponse {
	projects: Project[];
	permissions: { manage: boolean };
}

export interface TeamOption {
	id: string;
	name: string;
	leadId: string;
	members?: { userId: string; status: string }[];
}

export type SortMode = 'featured' | 'newest' | 'stars';
export type ViewMode = 'grid' | 'kanban';
