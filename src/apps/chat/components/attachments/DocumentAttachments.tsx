'use client';

import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Maximize2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatAttachmentItem } from '../../types';
import { ChatMarkdown } from './ChatMarkdown';
import { formatAttachmentBytes } from './attachmentUtils';
import s from '../../ChatAttachments.module.css';

export function TextPreview({
	attachment,
	markdown,
	onOpen,
}: {
	attachment: ChatAttachmentItem;
	markdown?: boolean;
	onOpen: (attachment: ChatAttachmentItem) => void;
}) {
	const { t } = useI18n();
	const [content, setContent] = useState<string | null>(null);
	const [error, setError] = useState(false);
	const [expanded, setExpanded] = useState(false);

	useEffect(() => {
		let cancelled = false;
		fetch(attachment.url, { credentials: 'same-origin' })
			.then((res) => {
				if (!res.ok) throw new Error();
				return res.text();
			})
			.then((text) => {
				if (!cancelled) setContent(text.slice(0, 60_000));
			})
			.catch(() => {
				if (!cancelled) setError(true);
			});
		return () => {
			cancelled = true;
		};
	}, [attachment.url]);

	return (
		<div className={s.textAttachment}>
			<div className={s.attachmentHeader}>
				<span className={s.attachmentName}>{attachment.name}</span>
				<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
					<button type="button" className={s.attachmentAction} onClick={() => setExpanded((v) => !v)}>
						{expanded ? t('chatAttachmentCollapse') : t('chatAttachmentPreview')}
					</button>
					<button
						type="button"
						className={s.attachmentAction}
						onClick={() => onOpen(attachment)}
						title={t('chatAttachmentPreview')}
					>
						<Maximize2 size={12} />
					</button>
				</div>
			</div>
			{error ? (
				<a className={s.attachmentAction} href={attachment.url} download={attachment.name}>
					<Download size={12} /> {t('chatAttachmentDownload')}
				</a>
			) : content === null ? (
				<div className={s.attachmentLoading}>{t('loading')}</div>
			) : expanded ? (
				<div className={s.markdownScroll}>
					{markdown ? <ChatMarkdown source={content} /> : <pre className={s.textPre}>{content}</pre>}
				</div>
			) : (
				<div className={s.textSnippet}>
					{content.slice(0, 240)}{content.length > 240 ? '…' : ''}
				</div>
			)}
		</div>
	);
}

export function PdfAttachment({
	attachment,
	onOpen,
}: {
	attachment: ChatAttachmentItem;
	onOpen: (attachment: ChatAttachmentItem) => void;
}) {
	const { t } = useI18n();
	const [expanded, setExpanded] = useState(false);
	return (
		<div className={s.pdfAttachment}>
			<div className={s.attachmentHeader}>
				<span className={s.attachmentName}>
					<FileText size={13} /> {attachment.name}
					{attachment.size ? <span className={s.attachmentMeta}>{formatAttachmentBytes(attachment.size)}</span> : null}
				</span>
				<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
					<button type="button" className={s.attachmentAction} onClick={() => setExpanded((v) => !v)}>
						{expanded ? t('chatAttachmentCollapse') : t('chatAttachmentPreview')}
					</button>
					<button
						type="button"
						className={s.attachmentAction}
						onClick={() => onOpen(attachment)}
						title={t('chatAttachmentPreview')}
					>
						<Maximize2 size={12} />
					</button>
					<a className={s.attachmentAction} href={attachment.url} target="_blank" rel="noreferrer noopener">
						<ExternalLink size={12} />
					</a>
				</div>
			</div>
			{expanded && (
				<iframe
					className={s.pdfFrame}
					src={attachment.url}
					title={attachment.name}
					loading="lazy"
				/>
			)}
		</div>
	);
}
