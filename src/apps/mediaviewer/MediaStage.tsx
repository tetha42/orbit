'use client';

import React from 'react';
import { AlertCircle, Download, Loader2, Music } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { downloadMedia, type MediaViewerItem, type mediaPreviewKind } from '@/core/mediaViewer';
import s from './MediaViewer.module.css';

interface MediaStageProps {
	item: MediaViewerItem;
	kind: ReturnType<typeof mediaPreviewKind>;
	mediaError: boolean;
	setMediaError: (v: boolean) => void;
	text: string | null;
	textError: boolean;
	zoom: number;
	setZoom: React.Dispatch<React.SetStateAction<number>>;
	isPanning: boolean;
	imageScrollerRef: React.RefObject<HTMLDivElement | null>;
	startPan: (e: React.PointerEvent<HTMLDivElement>) => void;
	movePan: (e: React.PointerEvent<HTMLDivElement>) => void;
	endPan: (e: React.PointerEvent<HTMLDivElement>) => void;
	setDimensions: (dims: { width: number; height: number } | null) => void;
}

export function MediaStage({
	item,
	kind,
	mediaError,
	setMediaError,
	text,
	textError,
	zoom,
	setZoom,
	isPanning,
	imageScrollerRef,
	startPan,
	movePan,
	endPan,
	setDimensions,
}: MediaStageProps) {
	const { t } = useI18n();

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
				style={{
					touchAction: zoom > 1 ? 'none' : 'auto',
					cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
				}}
			>
				<div
					className={s.imageCanvas}
					style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
				>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						className={s.image}
						src={item.url}
						alt={item.name}
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
				<source src={item.url} type={item.type || undefined} />
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
				<div className={s.audioName}>{item.name}</div>
				<audio className={s.audio} controls preload="metadata" onError={() => setMediaError(true)}>
					<source src={item.url} type={item.type || undefined} />
				</audio>
			</div>
		);
	}

	if (kind === 'pdf') {
		return <iframe className={s.pdfFrame} src={item.url} title={item.name} loading="eager" />;
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
}
