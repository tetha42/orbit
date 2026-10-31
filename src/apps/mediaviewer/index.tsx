'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
	AlertCircle,
	Download,
	ExternalLink,
	Film,
	FileArchive,
	FileText,
	ImageIcon,
	Info,
	Loader2,
	Maximize2,
	Music,
	X,
	ZoomIn,
	ZoomOut,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useIsActive } from '@/core/windows';
import {
	downloadMedia,
	mediaPreviewKind,
	useMediaViewerItem,
} from '@/core/mediaViewer';
import { readExif, type ExifValue } from './exif';
import s from './MediaViewer.module.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

const EXIF_LABEL_KEYS: Record<string, string> = {
	make: 'mediaExifMake',
	model: 'mediaExifModel',
	orientation: 'mediaExifOrientation',
	software: 'mediaExifSoftware',
	dateTaken: 'mediaExifDateTaken',
	modified: 'mediaExifModified',
	exposure: 'mediaExifExposure',
	aperture: 'mediaExifAperture',
	apertureApex: 'mediaExifAperture',
	iso: 'mediaExifIso',
	focalLength: 'mediaExifFocalLength',
	focalLength35: 'mediaExifFocalLength35',
	flash: 'mediaExifFlash',
	gps: 'mediaExifGps',
	xResolution: 'mediaExifXResolution',
	yResolution: 'mediaExifYResolution',
	resolutionUnit: 'mediaExifResolutionUnit',
	colorSpace: 'mediaExifColorSpace',
	exposureBias: 'mediaExifExposureBias',
	meteringMode: 'mediaExifMeteringMode',
	lightSource: 'mediaExifLightSource',
	pixelWidth: 'mediaViewerWidth',
	pixelHeight: 'mediaViewerHeight',
};

function formatBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function kindIcon(kind: ReturnType<typeof mediaPreviewKind>) {
	if (kind === 'image') return <ImageIcon size={13} />;
	if (kind === 'video') return <Film size={13} />;
	if (kind === 'audio') return <Music size={13} />;
	if (kind === 'pdf' || kind === 'text') return <FileText size={13} />;
	return <FileArchive size={13} />;
}

function clampZoom(value: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className={s.infoRow}>
			<span className={s.infoLabel}>{label}</span>
			<span className={s.infoValue}>{value || '—'}</span>
		</div>
	);
}

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
		setBytes(item?.boyut);
		setDimensions(null);
		pendingZoomFocus.current = null;
	}, [item]);

	useEffect(() => {
		if (!item || kind !== 'text') return;
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
				return;
			}
			if (key === '-' || key === '_') {
				event.preventDefault();
				if (kind === 'image') setZoom((value) => clampZoom(value - ZOOM_STEP));
				return;
			}
			if (key === '0') {
				event.preventDefault();
				setZoom(1);
				return;
			}
			if (key === 'i' || key === 'I') {
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
		panRef.current = {
			x: event.clientX,
			y: event.clientY,
			left: scroller.scrollLeft,
			top: scroller.scrollTop,
		};
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

	const fallback = (
		<div className={s.error}>
			<AlertCircle size={28} />
			<span className={s.errorTitle}>
				{t('mediaViewerPreviewUnavailable', 'This file cannot be previewed in the browser.')}
			</span>
			<button type="button" className={s.downloadButton} onClick={() => downloadMedia(item)}>
				<Download size={13} />
				{t('chatAttachmentDownload', 'Download')}
			</button>
		</div>
	);

	const content = (() => {
		if (kind === 'image') {
			if (mediaError) return fallback;
			return (
				<div
					className={`${s.imageScroller} ${isPanning ? s.imageScrollerPanning : ''}`}
					ref={imageScrollerRef}
					onPointerDown={startPan}
					onPointerMove={movePan}
					onPointerUp={endPan}
					onPointerCancel={endPan}
					onDoubleClick={() => setZoom((value) => (value > 1 ? 1 : 2))}
					style={{ touchAction: zoom > 1 ? 'none' : 'auto', cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
				>
					<div
						className={s.imageCanvas}
						style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							className={s.image}
							src={item.url}
							alt={item.ad}
							onLoad={(event) =>
								setDimensions({
									width: event.currentTarget.naturalWidth,
									height: event.currentTarget.naturalHeight,
								})
							}
							onError={() => setMediaError(true)}
							onDoubleClick={() => setZoom((value) => (value > 1 ? 1 : 2))}
							draggable={false}
						/>
					</div>
				</div>
			);
		}
		if (kind === 'video') {
			return mediaError ? (
				fallback
			) : (
				<video
					className={s.video}
					controls
					playsInline
					preload="metadata"
					onError={() => setMediaError(true)}
				>
					<source src={item.url} type={item.tip || undefined} />
				</video>
			);
		}
		if (kind === 'audio') {
			return mediaError ? (
				fallback
			) : (
				<div className={s.audioWrap}>
					<div className={s.audioIcon}>
						<Music size={30} />
					</div>
					<div className={s.audioName}>{item.ad}</div>
					<audio className={s.audio} controls preload="metadata" onError={() => setMediaError(true)}>
						<source src={item.url} type={item.tip || undefined} />
					</audio>
				</div>
			);
		}
		if (kind === 'pdf') {
			return <iframe className={s.pdfFrame} src={item.url} title={item.ad} loading="eager" />;
		}
		if (kind === 'text') {
			if (textError) return fallback;
			if (text === null) {
				return (
					<div className={s.loading}>
						<Loader2 size={18} className={s.spinner} />
						{t('loading')}
					</div>
				);
			}
			return (
				<div className={s.textBody}>
					<pre className={s.textPre}>{text}</pre>
				</div>
			);
		}
		return fallback;
	})();

	return (
		<div className={s.appBody}>
			<div className={`${s.stage} ${kind === 'image' ? s.stageImage : ''}`}>{content}</div>

			<div className={s.actions}>
				<span className={s.fileLabel} title={item.ad}>
					{kindIcon(kind)}
					<span>{item.ad}</span>
					{bytes ? <span className={s.fileMeta}>{formatBytes(bytes)}</span> : null}
				</span>

				{kind === 'image' && (
					<div className={s.zoomControls}>
						<button
							type="button"
							className={s.actionButton}
							onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
							disabled={zoom <= MIN_ZOOM}
							title={`${t('mediaViewerZoomOut', 'Zoom out')} (-)`}
							aria-label={t('mediaViewerZoomOut', 'Zoom out')}
						>
							<ZoomOut size={14} />
						</button>
						<span className={s.zoomValue}>{Math.round(zoom * 100)}%</span>
						<button
							type="button"
							className={s.actionButton}
							onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
							disabled={zoom >= MAX_ZOOM}
							title={`${t('mediaViewerZoomIn', 'Zoom in')} (+)`}
							aria-label={t('mediaViewerZoomIn', 'Zoom in')}
						>
							<ZoomIn size={14} />
						</button>
						<button
							type="button"
							className={s.actionButton}
							onClick={() => setZoom(1)}
							title={`${t('mediaViewerZoomReset', 'Fit to window')} (0)`}
							aria-label={t('mediaViewerZoomReset', 'Fit to window')}
						>
							<Maximize2 size={13} />
						</button>
					</div>
				)}

				<button
					type="button"
					className={`${s.actionButton} ${infoOpen ? s.actionButtonActive : ''}`}
					onClick={() => setInfoOpen((value) => !value)}
					title={`${t('mediaViewerInfo', 'File information')} (I)`}
					aria-label={t('mediaViewerInfo', 'File information')}
					aria-pressed={infoOpen}
				>
					<Info size={14} />
				</button>
				<a
					className={s.actionButton}
					href={item.url}
					download={item.ad}
					title={t('chatAttachmentDownload', 'Download')}
				>
					<Download size={14} />
				</a>
				<a
					className={s.actionButton}
					href={item.url}
					target="_blank"
					rel="noreferrer noopener"
					title={t('mediaViewerOpenOriginal', 'Open original')}
				>
					<ExternalLink size={14} />
				</a>
			</div>

			{infoOpen && (
				<aside className={s.infoPanel} aria-label={t('mediaViewerInfoTitle', 'File information')}>
					<div className={s.infoHeader}>
						<strong>{t('mediaViewerInfoTitle', 'File information')}</strong>
						<button
							type="button"
							className={s.infoClose}
							onClick={() => setInfoOpen(false)}
							aria-label={t('close', 'Close')}
						>
							<X size={14} />
						</button>
					</div>

					<div className={s.infoSection}>
						<div className={s.infoSectionTitle}>{t('mediaViewerBasicInfo', 'Basic information')}</div>
						<InfoRow label={t('mediaViewerFileName', 'File name')} value={item.ad} />
						<InfoRow label={t('mediaViewerFileType', 'Type')} value={item.tip || '—'} />
						<InfoRow label={t('mediaViewerFileSize', 'Size')} value={formatBytes(bytes) || '—'} />
						{kind === 'image' && (
							<InfoRow
								label={t('mediaViewerDimensions', 'Dimensions')}
								value={dimensions ? `${dimensions.width} × ${dimensions.height}` : '—'}
							/>
						)}
					</div>

					{kind === 'image' ? (
						<div className={s.infoSection}>
							<div className={s.infoSectionTitle}>{t('mediaViewerExifInfo', 'EXIF data')}</div>
							{exifLoading ? (
								<div className={s.infoEmpty}>
									<Loader2 size={14} className={s.spinner} />
									{t('loading')}
								</div>
							) : exif.length > 0 ? (
								<div className={s.exifGrid}>
									{exif.map((entry) => (
										<InfoRow
											key={entry.key}
											label={t(EXIF_LABEL_KEYS[entry.key] ?? entry.key, entry.key)}
											value={entry.value}
										/>
									))}
								</div>
							) : (
								<div className={s.infoEmpty}>{t('mediaViewerNoExif', 'No readable EXIF data in this image.')}</div>
							)}
						</div>
					) : (
						<div className={s.infoSection}>
							<div className={s.infoSectionTitle}>{t('mediaViewerExifInfo', 'EXIF data')}</div>
							<div className={s.infoEmpty}>{t('mediaViewerExifOnly', 'EXIF data is available for image files only.')}</div>
						</div>
					)}

					<div className={s.infoHint}>
						{t('mediaViewerZoomHint', 'Use +/- to zoom, 0 to fit, and I to toggle this panel.')}
					</div>
				</aside>
			)}
		</div>
	);
}
