'use client';

import React from 'react';
import { Loader2, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { MediaViewerItem, mediaPreviewKind } from '@/core/mediaViewer';
import type { ExifValue } from './exif';
import { EXIF_LABEL_KEYS, formatMediaBytes } from './constants';
import s from './MediaViewer.module.css';

interface MediaInfoPanelProps {
	item: MediaViewerItem;
	kind: ReturnType<typeof mediaPreviewKind>;
	bytes: number | undefined;
	dimensions: { width: number; height: number } | null;
	exif: ExifValue[];
	exifLoading: boolean;
	onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className={s.infoRow}>
			<span className={s.infoLabel}>{label}</span>
			<span className={s.infoValue}>{value || '—'}</span>
		</div>
	);
}

export function MediaInfoPanel({
	item,
	kind,
	bytes,
	dimensions,
	exif,
	exifLoading,
	onClose,
}: MediaInfoPanelProps) {
	const { t } = useI18n();

	return (
		<aside className={s.infoPanel} aria-label={t('mediaViewerInfoTitle', 'File information')}>
			<div className={s.infoHeader}>
				<strong>{t('mediaViewerInfoTitle', 'File information')}</strong>
				<button
					type="button"
					className={s.infoClose}
					onClick={onClose}
					aria-label={t('close', 'Close')}
				>
					<X size={14} />
				</button>
			</div>

			<div className={s.infoSection}>
				<div className={s.infoSectionTitle}>{t('mediaViewerBasicInfo', 'Basic information')}</div>
				<InfoRow label={t('mediaViewerFileName', 'File name')} value={item.name} />
				<InfoRow label={t('mediaViewerFileType', 'Type')} value={item.type || '—'} />
				<InfoRow label={t('mediaViewerFileSize', 'Size')} value={formatMediaBytes(bytes) || '—'} />
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
	);
}
