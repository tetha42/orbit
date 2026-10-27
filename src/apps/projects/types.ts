import type { Project } from '@/db/schema';

export interface ProjectsResponse {
	projeler: Project[];
	izinler: { manage: boolean };
}

export interface TeamOption {
	id: string;
	ad: string;
	liderId: string;
	uyeler?: { userId: string; status: string }[];
}

export type SortMode = 'featured' | 'newest' | 'stars';
export type ViewMode = 'grid' | 'kanban';
