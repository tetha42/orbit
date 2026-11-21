import type React from 'react';
import type { DialogApi } from '@/components/Common/DialogProvider';
import { DEFAULT_WALLPAPER } from '@/core/theme';
import { errorMessage } from '@/lib/errors';
import type {
	CustomWallpaperItem,
	DisplayWallpaper,
	WallpaperOverride,
} from './types';

interface UseWallpaperMutationsParams {
	t: (key: string, fallback?: string) => string;
	dialog: DialogApi;
	canManage: boolean;
	busy: boolean;
	activeWallpaper: string;
	setWallpaper: (src: string) => void;
	customWallpapers: CustomWallpaperItem[];
	setCustomWallpapers: React.Dispatch<React.SetStateAction<CustomWallpaperItem[]>>;
	overrides: Record<string, WallpaperOverride>;
	setOverrides: React.Dispatch<React.SetStateAction<Record<string, WallpaperOverride>>>;
	setBusy: React.Dispatch<React.SetStateAction<boolean>>;
	setFeedback: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useWallpaperMutations({
	t,
	dialog,
	canManage,
	busy,
	activeWallpaper,
	setWallpaper,
	customWallpapers,
	setCustomWallpapers,
	overrides,
	setOverrides,
	setBusy,
	setFeedback,
}: UseWallpaperMutationsParams) {
	const restoreWallpaper = async (id: string, titleTr: string, titleEn: string) => {
		if (!canManage || busy) return;
		setBusy(true);
		setFeedback(null);
		try {
			const res = await fetch('/api/settings/wallpapers', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, titleTr, titleEn, builtin: true, restore: true }),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperSaveFailed'));
			setOverrides(data.overrides ?? {});
			setFeedback(t('settingsWallpaperRestored'));
		} catch (error: unknown) {
			setFeedback(errorMessage(error, t('settingsWallpaperSaveFailed')));
		} finally {
			setBusy(false);
		}
	};

	const uploadWallpaper = async (file: File) => {
		if (!canManage || busy) return;
		const defaultName = file.name.replace(/\.[^.]+$/, '');
		const titleEn = await dialog.prompt({
			title: t('settingsWallpaperAdd'),
			message: t('settingsWallpaperNameEn'),
			defaultValue: defaultName,
			required: true,
		});
		if (!titleEn?.trim()) return;

		setBusy(true);
		setFeedback(null);
		try {
			const form = new FormData();
			form.append('file', file);
			form.append('titleTr', titleEn.trim());
			form.append('titleEn', titleEn.trim());
			form.append('type', 'custom');
			const res = await fetch('/api/settings/wallpapers', { method: 'POST', body: form });
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperUploadFailed'));
			setCustomWallpapers((prev) => [...prev, data.wallpaper]);
			setFeedback(t('settingsWallpaperAdded'));
		} catch (error: unknown) {
			setFeedback(errorMessage(error, t('settingsWallpaperUploadFailed')));
		} finally {
			setBusy(false);
		}
	};

	const renameWallpaper = async (wallpaper: DisplayWallpaper) => {
		if (!canManage || busy) return;
		const source = customWallpapers.find((item) => item.id === wallpaper.id);
		const override = overrides[wallpaper.id];
		const titleEn = await dialog.prompt({
			title: t('settingsWallpaperRename'),
			message: t('settingsWallpaperNameEn'),
			defaultValue: source?.titleEn ?? override?.titleEn ?? wallpaper.title,
			required: true,
		});
		if (!titleEn?.trim()) return;
		const titleTr = titleEn.trim();

		setBusy(true);
		setFeedback(null);
		try {
			const payload = wallpaper.custom
				? { id: wallpaper.id, titleTr: titleTr.trim(), titleEn: titleEn.trim() }
				: { id: wallpaper.id, titleTr: titleTr.trim(), titleEn: titleEn.trim(), builtin: true };
			const res = await fetch('/api/settings/wallpapers', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperSaveFailed'));
			if (wallpaper.custom && data.wallpaper) {
				setCustomWallpapers((prev) =>
					prev.map((item) => (item.id === wallpaper.id ? data.wallpaper : item)),
				);
			} else if (data.overrides) {
				setOverrides(data.overrides);
			}
			setFeedback(t('settingsWallpaperRenamed'));
		} catch (error: unknown) {
			setFeedback(errorMessage(error, t('settingsWallpaperSaveFailed')));
		} finally {
			setBusy(false);
		}
	};

	const deleteWallpaper = async (wallpaper: DisplayWallpaper) => {
		if (!canManage || busy) return;
		const confirmed = await dialog.confirm({
			title: wallpaper.custom ? t('settingsWallpaperDelete') : t('settingsWallpaperHide'),
			message: wallpaper.custom
				? t('settingsWallpaperDeleteConfirm')
				: t('settingsWallpaperHideConfirm'),
			tone: 'danger',
		});
		if (!confirmed) return;

		setBusy(true);
		setFeedback(null);
		try {
			const query = `id=${encodeURIComponent(wallpaper.id)}${wallpaper.custom ? '' : '&builtin=1'}`;
			const res = await fetch(`/api/settings/wallpapers?${query}`, { method: 'DELETE' });
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || t('settingsWallpaperDeleteFailed'));
			if (wallpaper.custom) {
				setCustomWallpapers((prev) => prev.filter((item) => item.id !== wallpaper.id));
			} else if (data.overrides) {
				setOverrides(data.overrides);
			}
			if (activeWallpaper === wallpaper.src) {
				setWallpaper(DEFAULT_WALLPAPER);
			}
			setFeedback(wallpaper.custom ? t('settingsWallpaperDeleted') : t('settingsWallpaperHidden'));
		} catch (error: unknown) {
			setFeedback(errorMessage(error, t('settingsWallpaperDeleteFailed')));
		} finally {
			setBusy(false);
		}
	};

	return {
		restoreWallpaper,
		uploadWallpaper,
		renameWallpaper,
		deleteWallpaper,
	};
}
