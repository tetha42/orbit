import type { NewsVisibility } from '@/types/news';

export interface NewsEntry {
	id: string;
	slug: string;
	title: string;
	summary: string;
	content: string;
	category: string;
	isImportant: number;
	imageUrl?: string;
	publishStatus: NewsVisibility;
	publishDate: number | null;
	authorId?: string;
	authorNameSurname?: string;
	creation: number;
	update: number;
}
