import type React from 'react';

export type WallpaperCategory =
	| 'all'
	| 'space'
	| 'dynamic'
	| 'landscape'
	| 'abstract'
	| 'custom';

export interface CustomWallpaperItem {
	id: string;
	titleTr: string;
	titleEn: string;
	type: string;
	url: string;
}

export interface DisplayWallpaper {
	id: string;
	title: string;
	type: string;
	src: string;
	category: Exclude<WallpaperCategory, 'all'>;
	isSpace: boolean;
	is3D: boolean;
	custom?: boolean;
}

export interface WallpaperOverride {
	titleTr?: string;
	titleEn?: string;
	hidden?: boolean;
}

export interface WallpaperCategoryItem {
	id: WallpaperCategory;
	label: string;
	icon: React.ReactNode;
	count: number;
}
