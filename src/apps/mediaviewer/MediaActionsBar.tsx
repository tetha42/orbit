'use client';

import React from 'react';
import { Download, ExternalLink, Info, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { MediaViewerItem, mediaPreviewKind } from '@/core/mediaViewer';
import { clampZoom, formatMediaBytes, kindIcon, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from './constants';
import s from './MediaViewer.module.css';

interface MediaActionsBarProps {
	item: MediaViewerItem;
	kind: ReturnType<typeof mediaPreviewKind>;
	bytes: number | undefined;
	zoom: number;
	setZoom: React.Dispatch<React.SetStateAction<number>>;
	infoOpen: boolean;
	setInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function MediaActionsBar({
	item,
	kind,
	bytes,
	zoom,
	setZoom,
	infoOpen,
	setInfoOpen,
}: MediaActionsBarProps) {
	const { t } = useI18n();

	return (
		<div className={s.actions}>
			<span className={s.fileLabel} title={item.name}>
				{kindIcon(kind)}
				<span>{item.name}</span>
				{bytes ? <span className={s.fileMeta}>{formatMediaBytes(bytes)}</span> : null}
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
				download={item.name}
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
	);
}
