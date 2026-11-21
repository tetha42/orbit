'use client';

import React from 'react';
import { Film, Maximize2, Music, ZoomIn } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatAttachmentItem } from '../../types';
import { formatAttachmentBytes } from './attachmentUtils';
import s from '../../ChatAttachments.module.css';

export function ImageAttachment({
	attachment,
	onOpen,
}: {
	attachment: ChatAttachmentItem;
	onOpen: (attachment: ChatAttachmentItem) => void;
}) {
	return (
		<button
			type="button"
			className={s.imageAttachment}
			onClick={() => onOpen(attachment)}
			title={attachment.name}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={attachment.url} alt={attachment.name} loading="lazy" />
			<span className={s.zoomBadge} aria-hidden="true">
				<ZoomIn size={15} />
			</span>
		</button>
	);
}

export function VideoAttachment({
	attachment,
	onOpen,
}: {
	attachment: ChatAttachmentItem;
	onOpen: (attachment: ChatAttachmentItem) => void;
}) {
	const { t } = useI18n();
	return (
		<div className={s.mediaPlayer}>
			<video controls preload="metadata" className={s.mediaElement}>
				<source src={attachment.url} type={attachment.type || undefined} />
			</video>
			<div className={s.mediaCaption}>
				<Film size={12} />
				<span>{attachment.name}</span>
				{attachment.size ? <span className={s.attachmentMeta}>{formatAttachmentBytes(attachment.size)}</span> : null}
				<button
					type="button"
					className={s.mediaOpenBtn}
					onClick={() => onOpen(attachment)}
					title={t('chatAttachmentPreview')}
				>
					<Maximize2 size={12} />
				</button>
			</div>
		</div>
	);
}

export function AudioAttachment({
	attachment,
	onOpen,
}: {
	attachment: ChatAttachmentItem;
	onOpen: (attachment: ChatAttachmentItem) => void;
}) {
	const { t } = useI18n();
	return (
		<div className={s.mediaPlayer}>
			<div className={s.mediaCaption}>
				<Music size={12} />
				<span>{attachment.name}</span>
				{attachment.size ? <span className={s.attachmentMeta}>{formatAttachmentBytes(attachment.size)}</span> : null}
				<button
					type="button"
					className={s.mediaOpenBtn}
					onClick={() => onOpen(attachment)}
					title={t('chatAttachmentPreview')}
				>
					<Maximize2 size={12} />
				</button>
			</div>
			<audio controls preload="metadata" className={s.audioElement}>
				<source src={attachment.url} type={attachment.type || undefined} />
			</audio>
		</div>
	);
}
