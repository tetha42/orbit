'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useIsActive } from '@/core/windows';
import { mediaPreviewKind, useMediaViewerItem } from '@/core/mediaViewer';
import { readExif, type ExifValue } from './exif';
import contract from './mediaviewer.contract.json';
import { clampZoom, ZOOM_STEP } from './constants';
import { MediaStage } from './MediaStage';
import { MediaActionsBar } from './MediaActionsBar';
import { MediaInfoPanel } from './MediaInfoPanel';
import s from './MediaViewer.module.css';

export function MediaViewerApp() {
	const { t } = useI18n();
	const item = useMediaViewerItem();
	const isActive = useIsActive('mediaviewer');
	const [mediaError, setMediaError] = useState(false);
	const [text, setText] = useState<string | null>(null);
	const [textError, setTextError] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [infoOpen, setInfoOpen] = useState(false);
	const [exif, setExif] = useState<ExifValue[]>([]);
	const [exifLoading, setExifLoading] = useState(false);
	const [bytes, setBytes] = useState<number | undefined>(undefined);
	const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
	const imageScrollerRef = useRef<HTMLDivElement>(null);
	const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
	const [isPanning, setIsPanning] = useState(false);
	const pendingZoomFocus = useRef<{ ratioX: number; ratioY: number; offsetX: number; offsetY: number } | null>(null);
	const kind = item ? mediaPreviewKind(item) : 'unsupported';

	useEffect(() => {
		setMediaError(false);
		setText(null);
		setTextError(false);
		setZoom(1);
		setInfoOpen(false);
		setExif([]);
		setExifLoading(false);
		setBytes(item?.size);
		setDimensions(null);
		pendingZoomFocus.current = null;
	}, [item]);

	useEffect(() => {
		if (!item || kind !== 'text') return;
		const maxPreviewBytes = contract.limits.maxFileSizeMb * 1024 * 1024;
		if (item.size && item.size > maxPreviewBytes) {
			setTextError(true);
			return;
		}
		let cancelled = false;
		fetch(item.url, { credentials: 'same-origin' })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.text();
			})
			.then((value) => {
				if (!cancelled) setText(value.slice(0, 500_000));
			})
			.catch(() => {
				if (!cancelled) setTextError(true);
			});
		return () => {
			cancelled = true;
		};
	}, [item, kind]);

	useEffect(() => {
		if (!item || kind !== 'image') return;
		let cancelled = false;
		setExifLoading(true);
		fetch(item.url, { credentials: 'same-origin' })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.arrayBuffer();
			})
			.then((buffer) => {
				if (cancelled) return;
				setBytes(buffer.byteLength);
				setExif(readExif(buffer));
			})
			.catch(() => {
				if (!cancelled) setExif([]);
			})
			.finally(() => {
				if (!cancelled) setExifLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [item, kind]);

	useEffect(() => {
		if (!isActive) return;
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
			const key = event.key;
			if (key === '+' || key === '=') {
				event.preventDefault();
				if (kind === 'image') setZoom((value) => clampZoom(value + ZOOM_STEP));
			} else if (key === '-' || key === '_') {
				event.preventDefault();
				if (kind === 'image') setZoom((value) => clampZoom(value - ZOOM_STEP));
			} else if (key === '0') {
				event.preventDefault();
				setZoom(1);
			} else if (key === 'i' || key === 'I') {
				event.preventDefault();
				setInfoOpen((value) => !value);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isActive, kind]);

	useLayoutEffect(() => {
		const pending = pendingZoomFocus.current;
		const scroller = imageScrollerRef.current;
		if (!pending || !scroller) return;
		scroller.scrollLeft = pending.ratioX * scroller.scrollWidth - pending.offsetX;
		scroller.scrollTop = pending.ratioY * scroller.scrollHeight - pending.offsetY;
		pendingZoomFocus.current = null;
	}, [zoom]);

	useEffect(() => {
		const scroller = imageScrollerRef.current;
		if (!scroller || kind !== 'image') return;
		const onWheel = (event: WheelEvent) => {
			if (!event.shiftKey) return;
			event.preventDefault();
			event.stopPropagation();
			const delta = event.deltaY || event.deltaX;
			if (!delta) return;
			const rect = scroller.getBoundingClientRect();
			const offsetX = event.clientX - rect.left;
			const offsetY = event.clientY - rect.top;
			pendingZoomFocus.current = {
				ratioX: (scroller.scrollLeft + offsetX) / Math.max(1, scroller.scrollWidth),
				ratioY: (scroller.scrollTop + offsetY) / Math.max(1, scroller.scrollHeight),
				offsetX,
				offsetY,
			};
			const step = delta < 0 ? ZOOM_STEP : -ZOOM_STEP;
			setZoom((value) => {
				const next = clampZoom(value + step);
				if (next === value) pendingZoomFocus.current = null;
				return next;
			});
		};
		scroller.addEventListener('wheel', onWheel, { passive: false });
		return () => scroller.removeEventListener('wheel', onWheel);
	}, [kind, item]);

	const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
		if (zoom <= 1 || event.button !== 0) return;
		const scroller = imageScrollerRef.current;
		if (!scroller) return;
		panRef.current = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
		scroller.setPointerCapture(event.pointerId);
		setIsPanning(true);
		event.preventDefault();
	};

	const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
		const start = panRef.current;
		const scroller = imageScrollerRef.current;
		if (!start || !scroller) return;
		scroller.scrollLeft = start.left - (event.clientX - start.x);
		scroller.scrollTop = start.top - (event.clientY - start.y);
	};

	const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
		panRef.current = null;
		setIsPanning(false);
		const scroller = imageScrollerRef.current;
		if (scroller?.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
	};

	if (!item) {
		return (
			<div className={s.empty}>
				<ImageIcon size={30} />
				<span>{t('mediaViewerEmpty', 'Choose a media attachment in chat to preview it here.')}</span>
			</div>
		);
	}

	return (
		<div className={s.appBody}>
			<div className={`${s.stage} ${kind === 'image' ? s.stageImage : ''}`}>
				<MediaStage
					item={item}
					kind={kind}
					mediaError={mediaError}
					setMediaError={setMediaError}
					text={text}
					textError={textError}
					zoom={zoom}
					setZoom={setZoom}
					isPanning={isPanning}
					imageScrollerRef={imageScrollerRef}
					startPan={startPan}
					movePan={movePan}
					endPan={endPan}
					setDimensions={setDimensions}
				/>
			</div>
			<MediaActionsBar
				item={item}
				kind={kind}
				bytes={bytes}
				zoom={zoom}
				setZoom={setZoom}
				infoOpen={infoOpen}
				setInfoOpen={setInfoOpen}
			/>
			{infoOpen && (
				<MediaInfoPanel
					item={item}
					kind={kind}
					bytes={bytes}
					dimensions={dimensions}
					exif={exif}
					exifLoading={exifLoading}
					onClose={() => setInfoOpen(false)}
				/>
			)}
		</div>
	);
}
