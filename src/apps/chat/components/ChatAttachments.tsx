'use client';

import React, { useEffect, useState } from 'react';
import {
	Download,
	ExternalLink,
	FileArchive,
	FileText,
	Film,
	ImageIcon,
	Maximize2,
	Music,
	ZoomIn,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ChatAttachmentItem } from '../types';
import { openMediaAttachment } from '@/core/mediaViewer';
import { useWindowActions } from '@/core/windows';
import s from '../Chat.module.css';

function formatBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function kindOf(attachment: ChatAttachmentItem): 'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'text' | 'archive' | 'file' {
	const mime = (attachment.tip || '').toLowerCase();
	const name = attachment.ad.toLowerCase();
	if (mime.startsWith('image/')) return 'image';
	if (mime.startsWith('video/')) return 'video';
	if (mime.startsWith('audio/')) return 'audio';
	if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
	if (mime === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
	if (mime.startsWith('text/') || mime === 'application/json') return 'text';
	if (mime === 'application/zip' || name.match(/\.(zip|docx|xlsx|pptx|odt|ods|odp|epub|doc|xls|ppt)$/)) return 'archive';
	return 'file';
}

function fileIcon(kind: ReturnType<typeof kindOf>) {
	if (kind === 'image') return <ImageIcon size={16} />;
	if (kind === 'video') return <Film size={16} />;
	if (kind === 'audio') return <Music size={16} />;
	if (kind === 'archive') return <FileArchive size={16} />;
	return <FileText size={16} />;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	let index = 0;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
		const token = match[0];
		if (token.startsWith('**')) {
			nodes.push(<strong key={`${keyPrefix}-b-${index++}`}>{token.slice(2, -2)}</strong>);
		} else if (token.startsWith('*')) {
			nodes.push(<em key={`${keyPrefix}-i-${index++}`}>{token.slice(1, -1)}</em>);
		} else if (token.startsWith('`')) {
			nodes.push(
				<code key={`${keyPrefix}-c-${index++}`} className={s.markdownCode}>
					{token.slice(1, -1)}
				</code>
			);
		} else {
			const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
			if (link) {
				nodes.push(
					<a
						key={`${keyPrefix}-a-${index++}`}
						href={link[2]}
						target="_blank"
						rel="noreferrer noopener"
						className={s.markdownLink}
					>
						{link[1]}
					</a>
				);
			} else {
				nodes.push(token);
			}
		}
		lastIndex = match.index + token.length;
	}
	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
	return nodes;
}

/** Safe Markdown subset for chat attachments (headings, lists, quotes, inline styles). */
export function ChatMarkdown({ source }: { source: string }) {
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	const blocks: React.ReactNode[] = [];
	let list: string[] = [];
	let code: string[] | null = null;

	const flushList = () => {
		if (list.length === 0) return;
		blocks.push(
			<ul key={`list-${blocks.length}`} className={s.markdownList}>
				{list.map((item, index) => (
					<li key={index}>{renderInline(item, `li-${blocks.length}-${index}`)}</li>
				))}
			</ul>
		);
		list = [];
	};

	for (const [index, line] of lines.entries()) {
		if (line.trim().startsWith('```')) {
			if (code) {
				blocks.push(
					<pre key={`pre-${blocks.length}`} className={s.markdownPre}>
						<code>{code.join('\n')}</code>
					</pre>
				);
				code = null;
			} else {
				flushList();
				code = [];
			}
			continue;
		}
		if (code) {
			code.push(line);
			continue;
		}
		if (/^#{1,3}\s/.test(line)) {
			flushList();
			const level = line.match(/^#+/)?.[0].length ?? 1;
			const text = line.replace(/^#+\s*/, '');
			const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
			blocks.push(
				React.createElement(
					Tag,
					{ key: `h-${index}`, className: s.markdownHeading },
					renderInline(text, `h-${index}`)
				)
			);
			continue;
		}
		if (/^\s*[-*]\s+/.test(line)) {
			list.push(line.replace(/^\s*[-*]\s+/, ''));
			continue;
		}
		if (line.startsWith('> ')) {
			flushList();
			blocks.push(
				<blockquote key={`q-${index}`} className={s.markdownQuote}>
					{renderInline(line.slice(2), `q-${index}`)}
				</blockquote>
			);
			continue;
		}
		if (!line.trim()) {
			flushList();
			continue;
		}
		flushList();
		blocks.push(
			<p key={`p-${index}`} className={s.markdownParagraph}>
				{renderInline(line, `p-${index}`)}
			</p>
		);
	}
	if (code) {
		blocks.push(
			<pre key={`pre-${blocks.length}`} className={s.markdownPre}>
				<code>{code.join('\n')}</code>
			</pre>
		);
	}
	flushList();
	return <div className={s.markdownBody}>{blocks}</div>;
}

function TextPreview({
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
				<span className={s.attachmentName}>{attachment.ad}</span>
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
				<a className={s.attachmentAction} href={attachment.url} download={attachment.ad}>
					<Download size={12} /> {t('chatAttachmentDownload')}
				</a>
			) : content === null ? (
				<div className={s.attachmentLoading}>{t('loading')}</div>
			) : expanded ? (
				<div className={s.markdownScroll}>{markdown ? <ChatMarkdown source={content} /> : <pre className={s.textPre}>{content}</pre>}</div>
			) : (
				<div className={s.textSnippet}>{content.slice(0, 240)}{content.length > 240 ? '…' : ''}</div>
			)}
		</div>
	);
}

function PdfAttachment({
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
					<FileText size={13} /> {attachment.ad}
					{attachment.boyut ? <span className={s.attachmentMeta}>{formatBytes(attachment.boyut)}</span> : null}
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
					title={attachment.ad}
					loading="lazy"
				/>
			)}
		</div>
	);
}

function ImageAttachment({
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
			title={attachment.ad}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={attachment.url} alt={attachment.ad} loading="lazy" />
			<span className={s.zoomBadge} aria-hidden="true">
				<ZoomIn size={15} />
			</span>
		</button>
	);
}

function VideoAttachment({
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
				<source src={attachment.url} type={attachment.tip || undefined} />
			</video>
			<div className={s.mediaCaption}>
				<Film size={12} />
				<span>{attachment.ad}</span>
				{attachment.boyut ? <span className={s.attachmentMeta}>{formatBytes(attachment.boyut)}</span> : null}
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

function AudioAttachment({
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
				<span>{attachment.ad}</span>
				{attachment.boyut ? <span className={s.attachmentMeta}>{formatBytes(attachment.boyut)}</span> : null}
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
				<source src={attachment.url} type={attachment.tip || undefined} />
			</audio>
		</div>
	);
}

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
				const kind = kindOf(attachment);
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
						download={attachment.ad}
						target="_blank"
						rel="noreferrer noopener"
					>
						<span className={s.fileAttachmentIcon}>{fileIcon(kind)}</span>
						<span className={s.fileAttachmentBody}>
							<span className={s.attachmentName}>{attachment.ad}</span>
							<span className={s.attachmentMeta}>
								{formatBytes(attachment.boyut)} · {t('chatAttachmentDownload')}
							</span>
						</span>
						<Download size={14} />
					</a>
				);
			})}
		</div>
	);
}

export { kindOf as attachmentKind };
