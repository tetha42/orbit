'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatAttachmentItem } from '../types';
import { openMediaAttachment } from '@/core/mediaViewer';
import { useWindowActions } from '@/core/windows';
import {
	attachmentKind,
	fileAttachmentIcon,
	formatAttachmentBytes,
} from './attachments/attachmentUtils';
import { ChatMarkdown } from './attachments/ChatMarkdown';
import { PdfAttachment, TextPreview } from './attachments/DocumentAttachments';
import {
	AudioAttachment,
	ImageAttachment,
	VideoAttachment,
} from './attachments/MediaAttachments';
import s from '../ChatAttachments.module.css';

export function ChatAttachments({ attachments }: { attachments: ChatAttachmentItem[] }) {
	const { t } = useI18n();
	const { openApp } = useWindowActions();
	const openAttachment = (attachment: ChatAttachmentItem) => {
		if (openMediaAttachment(attachment)) openApp('mediaviewer');
	};
	if (!attachments || attachments.length === 0) return null;
	return (
		<div className={s.attachments}>
			{attachments.map((attachment, index) => {
				const kind = attachmentKind(attachment);
				if (kind === 'image') return <ImageAttachment key={index} attachment={attachment} onOpen={openAttachment} />;
				if (kind === 'video') return <VideoAttachment key={index} attachment={attachment} onOpen={openAttachment} />;
				if (kind === 'audio') return <AudioAttachment key={index} attachment={attachment} onOpen={openAttachment} />;
				if (kind === 'pdf') return <PdfAttachment key={index} attachment={attachment} onOpen={openAttachment} />;
				if (kind === 'markdown') return <TextPreview key={index} attachment={attachment} markdown onOpen={openAttachment} />;
				if (kind === 'text') return <TextPreview key={index} attachment={attachment} onOpen={openAttachment} />;
				return (
					<a
						key={index}
						className={s.fileAttachment}
						href={attachment.url}
						download={attachment.name}
						target="_blank"
						rel="noreferrer noopener"
					>
						<span className={s.fileAttachmentIcon}>{fileAttachmentIcon(kind)}</span>
						<span className={s.fileAttachmentBody}>
							<span className={s.attachmentName}>{attachment.name}</span>
							<span className={s.attachmentMeta}>
								{formatAttachmentBytes(attachment.size)} · {t('chatAttachmentDownload')}
							</span>
						</span>
						<Download size={14} />
					</a>
				);
			})}
		</div>
	);
}

export { ChatMarkdown, attachmentKind };
