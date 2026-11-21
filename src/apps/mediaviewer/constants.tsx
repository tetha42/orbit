import React from 'react';
import { FileArchive, FileText, Film, ImageIcon, Music } from 'lucide-react';
import { mediaPreviewKind } from '@/core/mediaViewer';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.25;

export const EXIF_LABEL_KEYS: Record<string, string> = {
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

export function formatMediaBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function kindIcon(kind: ReturnType<typeof mediaPreviewKind>) {
	if (kind === 'image') return <ImageIcon size={13} />;
	if (kind === 'video') return <Film size={13} />;
	if (kind === 'audio') return <Music size={13} />;
	if (kind === 'pdf' || kind === 'text') return <FileText size={13} />;
	return <FileArchive size={13} />;
}

export function clampZoom(value: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}
